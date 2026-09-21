import { describe, expect, it } from "vitest";
import { apiErrorCodeSchema } from "@bcoz/api";

const contractualErrorCodes = [
  "AUTHENTICATION_REQUIRED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION_ERROR",
  "REGISTRATION_CLOSED",
  "DUPLICATE_APPLICATION",
  "APPLICATION_NOT_EDITABLE",
  "REQUIRED_FIELD_MISSING",
  "REQUIRED_DOCUMENT_MISSING",
  "FILE_TYPE_NOT_ALLOWED",
  "FILE_TOO_LARGE",
  "UPLOAD_NOT_READY",
  "REPLACEMENT_NOT_ALLOWED",
  "CORRECTION_DEADLINE_PASSED",
  "CONFLICT_STALE_VERSION",
  "INVALID_STATUS_TRANSITION",
  "CAPACITY_REACHED",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
  "IDEMPOTENCY_KEY_REUSED",
  "OPERATION_IN_PROGRESS",
  "CONFIGURATION_CHANGED",
  "UPLOAD_EXPIRED",
  "FILE_INVALID",
  "REPLACEMENT_LIMIT_REACHED",
  "PRIVACY_ACKNOWLEDGEMENT_REQUIRED",
  "DEPENDENCY_UNAVAILABLE",
  "AUTH_LOGIN_CANCELLED",
  "AUTH_LOGIN_FAILED",
  "AUTH_PROVIDER_UNAVAILABLE",
] as const;

describe("API error contract", () => {
  it("accepts every stable error code from the wire specification", () => {
    for (const code of contractualErrorCodes) {
      expect(apiErrorCodeSchema.parse(code)).toBe(code);
    }
  });

  it("does not expose the former generic placeholder codes", () => {
    expect(apiErrorCodeSchema.safeParse("CONFLICT").success).toBe(false);
    expect(apiErrorCodeSchema.safeParse("DEADLINE_EXPIRED").success).toBe(false);
    expect(apiErrorCodeSchema.safeParse("UPLOAD_FAILED").success).toBe(false);
  });
});
