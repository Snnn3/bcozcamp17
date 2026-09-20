import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { env } from "@bcoz/config";
import {
  createAuthBoundaryDependencies,
  createGoogleOidcProvider,
  registerAuthRoutes,
  type AuthBoundaryOptions,
} from "./auth.js";
import { registerHealthRoute } from "./routes/health.js";

export interface BuildServerOptions {
  auth?: AuthBoundaryOptions;
}

export async function buildServer(options: BuildServerOptions = {}): Promise<FastifyInstance> {
  const server = Fastify({
    logger: {
      level: env.nodeEnv === "development" ? "info" : "warn",
    },
  });

  await server.register(cors, {
    origin: env.webOrigins,
    credentials: true,
  });
  await registerHealthRoute(server);
  const googleProvider =
    options.auth?.googleProvider ??
    createGoogleOidcProvider(env.googleClientId, env.googleClientSecret);
  registerAuthRoutes(
    server,
    createAuthBoundaryDependencies({
      ...options.auth,
      googleProvider,
      secureCookies: options.auth?.secureCookies ?? env.nodeEnv === "production",
    }),
    {
      allowedOrigins: env.webOrigins,
      googleClientId: env.googleClientId,
      googleRedirectUri: env.googleRedirectUri,
    },
  );

  return server;
}
