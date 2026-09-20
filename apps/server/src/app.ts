import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { env } from "@bcoz/config";
import { registerHealthRoute } from "./routes/health.js";

export async function buildServer(): Promise<FastifyInstance> {
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

  return server;
}
