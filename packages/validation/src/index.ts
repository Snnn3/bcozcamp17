import { z } from "zod";

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

export const roleCodeSchema = z.enum(["participant", "staff", "admin"]);

export type RoleCode = z.infer<typeof roleCodeSchema>;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const idempotencyKeySchema = z.string().trim().min(1).max(128);

export const applicationCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Z0-9-]+$/)
  .max(100);

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("api"),
});
