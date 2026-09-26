import { z } from "zod";

export const campStatusSchema = z.enum([
  "draft",
  "registration_open",
  "registration_closed",
  "archived",
]);

export type CampStatus = z.infer<typeof campStatusSchema>;

export const userStatusSchema = z.enum(["active", "disabled"]);

export type UserStatus = z.infer<typeof userStatusSchema>;

export const applicationStatusSchema = z.enum([
  "draft",
  "submitted",
  "reviewing",
  "action_required",
  "resubmitted",
  "accepted",
  "rejected",
  "waitlisted",
  "withdrawn",
]);

export type ApplicationStatus = z.infer<typeof applicationStatusSchema>;

export const documentStatusSchema = z.enum([
  "not_uploaded",
  "pending",
  "approved",
  "correction_required",
  "rejected",
]);

export type DocumentStatus = z.infer<typeof documentStatusSchema>;

export const documentReviewStatusSchema = z.enum(["approved", "correction_required", "rejected"]);

export type DocumentReviewStatus = z.infer<typeof documentReviewStatusSchema>;

export const uploadIntentStatusSchema = z.enum([
  "issued",
  "validating",
  "completed",
  "failed",
  "expired",
]);

export type UploadIntentStatus = z.infer<typeof uploadIntentStatusSchema>;

export const roleCodeSchema = z.enum(["participant", "staff", "admin"]);

export type RoleCode = z.infer<typeof roleCodeSchema>;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const idempotencyKeySchema = z
  .string()
  .regex(/^[\x20-\x7e]{16,128}$/, "Idempotency-Key must be 16-128 printable ASCII characters.");

export const positiveVersionSchema = z.number().int().positive();

export const applicationCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Z0-9-]+$/)
  .max(100);

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("api"),
});
