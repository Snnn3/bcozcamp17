import { z } from "zod";

export { healthResponseSchema } from "@bcoz/validation";

export const API_VERSION = "v1" as const;

export const apiErrorCodeSchema = z.enum([
  "AUTHENTICATION_REQUIRED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION_ERROR",
  "CONFLICT",
  "DEADLINE_EXPIRED",
  "UPLOAD_FAILED",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
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
