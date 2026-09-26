import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { env } from "@bcoz/config";
import { createDatabaseClient, type PrismaClient } from "@bcoz/db";
import {
  createAuthBoundaryDependencies,
  createGoogleOidcProvider,
  registerAuthRoutes,
  sendApiError,
  type AuthBoundaryOptions,
} from "./auth.js";
import { DependencyUnavailableError } from "@bcoz/api";
import { createCampSettingsReadinessCheck, type ReadinessCheck } from "./readiness.js";
import { registerHealthRoute } from "./routes/health.js";

export interface BuildServerOptions {
  auth?: AuthBoundaryOptions;
  readinessCheck?: ReadinessCheck;
}

export async function buildServer(options: BuildServerOptions = {}): Promise<FastifyInstance> {
  const server = Fastify({
    logger: {
      level: env.nodeEnv === "development" ? "info" : "warn",
    },
  });

  server.setErrorHandler((error: unknown, request, reply) => {
    const isDependencyFailure = error instanceof DependencyUnavailableError;
    request.log.error(isDependencyFailure ? "Dependency unavailable" : "Unhandled request error");
    return sendApiError(
      reply,
      isDependencyFailure ? 503 : 500,
      isDependencyFailure ? "DEPENDENCY_UNAVAILABLE" : "INTERNAL_ERROR",
      isDependencyFailure
        ? "A required service is temporarily unavailable."
        : "An unexpected error occurred.",
    );
  });

  await server.register(cors, {
    origin: env.webOrigins,
    credentials: true,
  });
  const googleProvider =
    options.auth?.googleProvider ??
    createGoogleOidcProvider(env.googleClientId, env.googleClientSecret);
  const canCreateDefaultDatabase =
    options.auth?.prisma === undefined &&
    options.auth?.sessionStore === undefined &&
    options.auth?.transactionStore === undefined &&
    options.auth?.userDirectory === undefined;
  const ownedPrisma: PrismaClient | undefined =
    canCreateDefaultDatabase && env.databaseUrl !== undefined
      ? createDatabaseClient(env.databaseUrl)
      : undefined;
  const readinessDatabase = options.auth?.prisma ?? ownedPrisma;
  const readinessCheck =
    options.readinessCheck ??
    (readinessDatabase === undefined
      ? undefined
      : createCampSettingsReadinessCheck(readinessDatabase));

  try {
    if (readinessCheck !== undefined) {
      await readinessCheck();
    }
    await registerHealthRoute(server, readinessCheck === undefined ? {} : { readinessCheck });
    registerAuthRoutes(
      server,
      createAuthBoundaryDependencies({
        ...options.auth,
        ...(ownedPrisma === undefined ? {} : { prisma: ownedPrisma }),
        googleProvider,
        production: env.nodeEnv === "production",
        secureCookies: options.auth?.secureCookies ?? env.nodeEnv === "production",
      }),
      {
        allowedOrigins: env.webOrigins,
        googleClientId: env.googleClientId,
        googleRedirectUri: env.googleRedirectUri,
      },
    );
  } catch (error: unknown) {
    if (ownedPrisma !== undefined) {
      await ownedPrisma.$disconnect();
    }
    throw error;
  }

  if (ownedPrisma !== undefined) {
    server.addHook("onClose", async () => {
      await ownedPrisma.$disconnect();
    });
  }

  return server;
}
