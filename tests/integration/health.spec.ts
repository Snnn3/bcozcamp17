import { describe, expect, it } from "vitest";
import { healthResponseSchema } from "@bcoz/api";

describe("API foundation contract", () => {
  it("accepts the stable health response shape", () => {
    const response = healthResponseSchema.parse({ status: "ok", service: "api" });

    expect(response).toEqual({ status: "ok", service: "api" });
  });
});
