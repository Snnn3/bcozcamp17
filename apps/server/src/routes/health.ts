import type { FastifyInstance } from "fastify";
import { healthResponseSchema } from "@bcoz/api";
import type { ReadinessCheck } from "../readiness.js";

export interface HealthRouteOptions {
  readinessCheck?: ReadinessCheck;
}

export async function registerHealthRoute(
  server: FastifyInstance,
  options: HealthRouteOptions = {},
): Promise<void> {
  server.get("/api/v1/health", async (request, reply) => {
    if (options.readinessCheck !== undefined) {
      try {
        await options.readinessCheck();
      } catch (error: unknown) {
        request.log.error({ err: error }, "API readiness check failed");
        return reply.code(503).send({
          error: {
            code: "DEPENDENCY_UNAVAILABLE",
            message: "API is not ready.",
            requestId: request.id,
          },
        });
      }
    }

    return healthResponseSchema.parse({
      status: "ok",
      service: "api",
    });
  });
}
