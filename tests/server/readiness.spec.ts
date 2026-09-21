import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { buildServer } from "../../apps/server/src/app";
import { registerHealthRoute } from "../../apps/server/src/routes/health";
import { createCampSettingsReadinessCheck } from "../../apps/server/src/readiness";

describe("camp settings readiness", () => {
  it("requires exactly one camp settings row", async () => {
    const missing = createCampSettingsReadinessCheck({
      campSettings: { count: async () => 0 },
    });
    const duplicated = createCampSettingsReadinessCheck({
      campSettings: { count: async () => 2 },
    });
    const ready = createCampSettingsReadinessCheck({
      campSettings: { count: async () => 1 },
    });

    await expect(missing()).rejects.toThrow("exactly one row");
    await expect(duplicated()).rejects.toThrow("exactly one row");
    await expect(ready()).resolves.toBeUndefined();
  });

  it("returns a safe dependency error when readiness fails", async () => {
    const server = Fastify();
    await registerHealthRoute(server, {
      readinessCheck: async () => {
        throw new Error("camp_settings row count: 0");
      },
    });

    const response = await server.inject({
      method: "GET",
      url: "/api/v1/health",
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      error: {
        code: "DEPENDENCY_UNAVAILABLE",
        message: "API is not ready.",
        requestId: expect.any(String),
      },
    });
    expect(response.body).not.toContain("camp_settings");
    await server.close();
  });

  it("fails server startup when the readiness check fails", async () => {
    const readinessFailure = new Error("readiness failed");

    await expect(
      buildServer({
        readinessCheck: async () => {
          throw readinessFailure;
        },
      }),
    ).rejects.toBe(readinessFailure);
  });
});
