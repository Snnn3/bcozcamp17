import { z } from "zod";

export { healthResponseSchema } from "@bcoz/validation";

export const API_VERSION = "v1" as const;

export const apiErrorCodeSchema = z.enum([
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
]);

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

export const fieldErrorSchema = z.object({
  field: z.string().min(1),
  message: z.string().min(1),
});

export const apiErrorSchema = z.object({
  code: apiErrorCodeSchema,
  message: z.string().min(1),
  fieldErrors: z.array(fieldErrorSchema).optional(),
  requestId: z.string().min(1).optional(),
});

export const apiErrorResponseSchema = z.object({
  error: apiErrorSchema,
});

export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;

export interface ApiSuccessResponse<TData> {
  data: TData;
  meta?: Readonly<Record<string, unknown>>;
}

export function createSuccessResponse<TData>(
  data: TData,
  meta?: Readonly<Record<string, unknown>>,
): ApiSuccessResponse<TData> {
  return meta === undefined ? { data } : { data, meta };
}
