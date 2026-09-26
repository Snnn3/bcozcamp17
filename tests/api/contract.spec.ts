import { describe, expect, it } from "vitest";
import {
  apiErrorResponseSchema,
  authorizedDocumentAccessResponseSchema,
  completeDocumentUploadRequestSchema,
  uploadIntentRequestSchema,
  uploadIntentResponseSchema,
} from "@bcoz/api";
import {
  applicationStatusSchema,
  campStatusSchema,
  documentReviewStatusSchema,
  documentStatusSchema,
  idempotencyKeySchema,
  userStatusSchema,
  uploadIntentStatusSchema,
} from "@bcoz/validation";

describe("shared API contract schemas", () => {
  it("enforces the normative idempotency-key shape", () => {
    expect(idempotencyKeySchema.safeParse("1234567890123456").success).toBe(true);
    expect(idempotencyKeySchema.safeParse("too-short").success).toBe(false);
    expect(idempotencyKeySchema.safeParse("contains\nnewline-123").success).toBe(false);
    expect(idempotencyKeySchema.safeParse("a".repeat(129)).success).toBe(false);
  });

  it("keeps lifecycle unions aligned with the database contract", () => {
    for (const status of [
      "draft",
      "registration_open",
      "registration_closed",
      "archived",
    ] as const) {
      expect(campStatusSchema.parse(status)).toBe(status);
    }
    for (const status of ["active", "disabled"] as const) {
      expect(userStatusSchema.parse(status)).toBe(status);
    }
    for (const status of [
      "draft",
      "submitted",
      "reviewing",
      "action_required",
      "resubmitted",
      "accepted",
      "rejected",
      "waitlisted",
      "withdrawn",
    ] as const) {
      expect(applicationStatusSchema.parse(status)).toBe(status);
    }
    for (const status of [
      "not_uploaded",
      "pending",
      "approved",
      "correction_required",
      "rejected",
    ] as const) {
      expect(documentStatusSchema.parse(status)).toBe(status);
    }
    for (const status of ["approved", "correction_required", "rejected"] as const) {
      expect(documentReviewStatusSchema.parse(status)).toBe(status);
    }
    for (const status of ["issued", "validating", "completed", "failed", "expired"] as const) {
      expect(uploadIntentStatusSchema.parse(status)).toBe(status);
    }
  });

  it("rejects unknown request fields and accepts the upload flow contract", () => {
    expect(
      uploadIntentRequestSchema.parse({
        fileName: "transcript.pdf",
        contentType: "application/pdf",
        sizeBytes: 1_024,
        expectedDocumentVersion: 1,
        configurationVersion: 1,
      }),
    ).toMatchObject({ fileName: "transcript.pdf" });
    expect(
      uploadIntentRequestSchema.safeParse({
        fileName: "transcript.pdf",
        contentType: "application/pdf",
        sizeBytes: 1_024,
        expectedDocumentVersion: 1,
        configurationVersion: 1,
        unexpected: true,
      }).success,
    ).toBe(false);

    expect(
      uploadIntentResponseSchema.parse({
        uploadId: "00000000-0000-0000-0000-000000000001",
        method: "PUT",
        uploadUrl: "https://storage.example/upload",
        requiredHeaders: { "Content-Type": "application/pdf" },
        expiresAt: "2026-01-10T01:00:00.000Z",
        documentVersion: 1,
        status: "issued",
      }),
    ).toHaveProperty("status", "issued");
    expect(completeDocumentUploadRequestSchema.parse({ checksum: "sha256:opaque-value" })).toEqual({
      checksum: "sha256:opaque-value",
    });
    expect(
      authorizedDocumentAccessResponseSchema.parse({
        downloadUrl: "https://storage.example/download",
        expiresAt: "2026-01-10T01:00:00.000Z",
      }),
    ).toHaveProperty("downloadUrl");
  });

  it("requires a request ID and rejects internal fields in error responses", () => {
    expect(
      apiErrorResponseSchema.parse({
        error: {
          code: "DEPENDENCY_UNAVAILABLE",
          message: "The service is temporarily unavailable.",
          requestId: "req_test_123",
        },
      }),
    ).toHaveProperty("error.requestId", "req_test_123");
    expect(
      apiErrorResponseSchema.safeParse({
        error: {
          code: "INTERNAL_ERROR",
          message: "PrismaClientKnownRequestError: SQL details",
          requestId: "req_test_123",
          stack: "internal",
        },
      }).success,
    ).toBe(false);
  });
});
