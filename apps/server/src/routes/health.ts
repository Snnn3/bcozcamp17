import type { FastifyInstance } from "fastify";
import { healthResponseSchema } from "@bcoz/api";

export async function registerHealthRoute(server: FastifyInstance): Promise<void> {
  server.get("/api/v1/health", async () =>
    healthResponseSchema.parse({
      status: "ok",
      service: "api",
    }),
  );
}
