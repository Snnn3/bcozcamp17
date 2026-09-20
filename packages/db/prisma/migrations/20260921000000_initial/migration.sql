-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "CampStatus" AS ENUM ('draft', 'registration_open', 'registration_closed', 'archived');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'disabled');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('draft', 'submitted', 'reviewing', 'action_required', 'resubmitted', 'accepted', 'rejected', 'waitlisted', 'withdrawn');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('not_uploaded', 'pending', 'approved', 'correction_required', 'rejected');

-- CreateEnum
CREATE TYPE "PermissionEffect" AS ENUM ('allow', 'deny');

-- CreateEnum
CREATE TYPE "ApplicationFieldType" AS ENUM ('text', 'number', 'date', 'boolean', 'single_choice', 'multi_choice');

-- CreateEnum
CREATE TYPE "UploadIntentStatus" AS ENUM ('issued', 'validating', 'completed', 'failed', 'expired');

-- CreateTable
CREATE TABLE "camp_settings" (
    "id" UUID NOT NULL,
    "singleton_key" INTEGER NOT NULL DEFAULT 1,
    "name" VARCHAR(255) NOT NULL,
    "status" "CampStatus" NOT NULL,
    "timezone" VARCHAR(64) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "registration_opens_at" TIMESTAMPTZ(3) NOT NULL,
    "registration_closes_at" TIMESTAMPTZ(3) NOT NULL,
    "correction_closes_at" TIMESTAMPTZ(3),
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "privacy_notice_version" VARCHAR(50) NOT NULL,
    "privacy_notice_url" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "camp_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "google_subject" VARCHAR(255) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "status" "UserStatus" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(150) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "user_permissions" (
    "user_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "effect" "PermissionEffect" NOT NULL,
    "granted_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("user_id","permission_id")
);

-- CreateTable
CREATE TABLE "participant_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "full_name" VARCHAR(255),
    "contact_email" VARCHAR(320),
    "phone" VARCHAR(50),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "participant_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_fields" (
    "id" UUID NOT NULL,
    "field_code" VARCHAR(100) NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "data_type" "ApplicationFieldType" NOT NULL,
    "is_required" BOOLEAN NOT NULL,
    "is_active" BOOLEAN NOT NULL,
    "display_order" INTEGER NOT NULL,

    CONSTRAINT "application_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_field_options" (
    "id" UUID NOT NULL,
    "field_id" UUID NOT NULL,
    "option_code" VARCHAR(100) NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "display_order" INTEGER NOT NULL,

    CONSTRAINT "application_field_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL,
    "participant_id" UUID NOT NULL,
    "application_code" VARCHAR(100),
    "status" "ApplicationStatus" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "submitted_at" TIMESTAMPTZ(3),
    "correction_deadline" TIMESTAMPTZ(3),
    "privacy_notice_version" VARCHAR(50) NOT NULL,
    "privacy_acknowledged_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_answers" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "field_id" UUID NOT NULL,
    "answer_text" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "application_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_answer_options" (
    "answer_id" UUID NOT NULL,
    "option_id" UUID NOT NULL,

    CONSTRAINT "application_answer_options_pkey" PRIMARY KEY ("answer_id","option_id")
);

-- CreateTable
CREATE TABLE "application_status_history" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "from_status" "ApplicationStatus",
    "to_status" "ApplicationStatus" NOT NULL,
    "reason" TEXT,
    "changed_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_types" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "is_required" BOOLEAN NOT NULL,
    "max_size_bytes" BIGINT NOT NULL,
    "max_count" INTEGER NOT NULL,
    "max_replacements" INTEGER NOT NULL,
    "replacement_allowed" BOOLEAN NOT NULL,
    "is_active" BOOLEAN NOT NULL,
    "display_order" INTEGER NOT NULL,

    CONSTRAINT "document_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mime_types" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255) NOT NULL,

    CONSTRAINT "mime_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_type_mime_types" (
    "document_type_id" UUID NOT NULL,
    "mime_type_id" UUID NOT NULL,

    CONSTRAINT "document_type_mime_types_pkey" PRIMARY KEY ("document_type_id","mime_type_id")
);

-- CreateTable
CREATE TABLE "application_documents" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "document_type_id" UUID NOT NULL,
    "status" "DocumentStatus" NOT NULL,
    "applicant_message" TEXT,
    "replacement_allowed" BOOLEAN NOT NULL,
    "current_submission_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "replacement_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "application_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_submissions" (
    "id" UUID NOT NULL,
    "application_document_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "original_filename" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "checksum" VARCHAR(128) NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "uploaded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_review_history" (
    "id" UUID NOT NULL,
    "application_document_id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "document_version" INTEGER NOT NULL,
    "status" "DocumentStatus" NOT NULL,
    "applicant_message" TEXT NOT NULL,
    "internal_note" TEXT,
    "replacement_allowed" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_review_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "in_app_notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMPTZ(3),

    CONSTRAINT "in_app_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_applications" (
    "notification_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,

    CONSTRAINT "notification_applications_pkey" PRIMARY KEY ("notification_id","application_id")
);

-- CreateTable
CREATE TABLE "notification_documents" (
    "notification_id" UUID NOT NULL,
    "application_document_id" UUID NOT NULL,

    CONSTRAINT "notification_documents_pkey" PRIMARY KEY ("notification_id","application_document_id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log_values" (
    "audit_log_id" UUID NOT NULL,
    "attribute_name" VARCHAR(100) NOT NULL,
    "old_value_text" TEXT,
    "new_value_text" TEXT,

    CONSTRAINT "audit_log_values_pkey" PRIMARY KEY ("audit_log_id","attribute_name")
);

-- CreateTable
CREATE TABLE "upload_intents" (
    "id" UUID NOT NULL,
    "application_document_id" UUID NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "base_document_version" INTEGER NOT NULL,
    "configuration_version" INTEGER NOT NULL,
    "staging_key" VARCHAR(500) NOT NULL,
    "immutable_key" VARCHAR(500),
    "original_filename" VARCHAR(255) NOT NULL,
    "declared_mime_type" VARCHAR(100) NOT NULL,
    "declared_size_bytes" BIGINT NOT NULL,
    "status" "UploadIntentStatus" NOT NULL,
    "failure_code" VARCHAR(100),
    "result_submission_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "lease_expires_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "upload_intents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "operation_scope" VARCHAR(255) NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "result_type" VARCHAR(50) NOT NULL,
    "result_id" UUID NOT NULL,
    "result_application_version" INTEGER,
    "result_document_version" INTEGER,
    "http_status" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "camp_settings_singleton_key_key" ON "camp_settings"("singleton_key");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_subject_key" ON "users"("google_subject");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "participant_profiles_user_id_key" ON "participant_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "application_fields_field_code_key" ON "application_fields"("field_code");

-- CreateIndex
CREATE UNIQUE INDEX "application_field_options_field_id_option_code_key" ON "application_field_options"("field_id", "option_code");

-- CreateIndex
CREATE UNIQUE INDEX "applications_participant_id_key" ON "applications"("participant_id");

-- CreateIndex
CREATE UNIQUE INDEX "applications_application_code_key" ON "applications"("application_code");

-- CreateIndex
CREATE UNIQUE INDEX "application_answers_application_id_field_id_key" ON "application_answers"("application_id", "field_id");

-- CreateIndex
CREATE INDEX "application_status_history_application_id_created_at_idx" ON "application_status_history"("application_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "document_types_code_key" ON "document_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "mime_types_code_key" ON "mime_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "application_documents_current_submission_id_key" ON "application_documents"("current_submission_id");

-- CreateIndex
CREATE UNIQUE INDEX "application_documents_id_current_submission_id_key" ON "application_documents"("id", "current_submission_id");

-- CreateIndex
CREATE UNIQUE INDEX "application_documents_application_id_document_type_id_key" ON "application_documents"("application_id", "document_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_submissions_storage_key_key" ON "document_submissions"("storage_key");

-- CreateIndex
CREATE UNIQUE INDEX "document_submissions_application_document_id_id_key" ON "document_submissions"("application_document_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "document_submissions_application_document_id_version_number_key" ON "document_submissions"("application_document_id", "version_number");

-- CreateIndex
CREATE INDEX "document_review_history_application_document_id_created_at_idx" ON "document_review_history"("application_document_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "upload_intents_staging_key_key" ON "upload_intents"("staging_key");

-- CreateIndex
CREATE UNIQUE INDEX "upload_intents_immutable_key_key" ON "upload_intents"("immutable_key");

-- CreateIndex
CREATE UNIQUE INDEX "upload_intents_result_submission_id_key" ON "upload_intents"("result_submission_id");

-- CreateIndex
CREATE INDEX "upload_intents_status_expires_at_idx" ON "upload_intents"("status", "expires_at");

-- CreateIndex
CREATE INDEX "upload_intents_uploaded_by_status_idx" ON "upload_intents"("uploaded_by", "status");

-- CreateIndex
CREATE UNIQUE INDEX "upload_intents_application_document_id_result_submission_id_key" ON "upload_intents"("application_document_id", "result_submission_id");

-- CreateIndex
CREATE INDEX "idempotency_records_expires_at_idx" ON "idempotency_records"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_actor_id_operation_scope_key_key" ON "idempotency_records"("actor_id", "operation_scope", "key");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participant_profiles" ADD CONSTRAINT "participant_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_field_options" ADD CONSTRAINT "application_field_options_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "application_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_answers" ADD CONSTRAINT "application_answers_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_answers" ADD CONSTRAINT "application_answers_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "application_fields"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_answer_options" ADD CONSTRAINT "application_answer_options_answer_id_fkey" FOREIGN KEY ("answer_id") REFERENCES "application_answers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_answer_options" ADD CONSTRAINT "application_answer_options_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "application_field_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_status_history" ADD CONSTRAINT "application_status_history_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_status_history" ADD CONSTRAINT "application_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_type_mime_types" ADD CONSTRAINT "document_type_mime_types_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_type_mime_types" ADD CONSTRAINT "document_type_mime_types_mime_type_id_fkey" FOREIGN KEY ("mime_type_id") REFERENCES "mime_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_id_current_submission_id_fkey" FOREIGN KEY ("id", "current_submission_id") REFERENCES "document_submissions"("application_document_id", "id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_submissions" ADD CONSTRAINT "document_submissions_application_document_id_fkey" FOREIGN KEY ("application_document_id") REFERENCES "application_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_submissions" ADD CONSTRAINT "document_submissions_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_review_history" ADD CONSTRAINT "document_review_history_application_document_id_fkey" FOREIGN KEY ("application_document_id") REFERENCES "application_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_review_history" ADD CONSTRAINT "document_review_history_application_document_id_submission_fkey" FOREIGN KEY ("application_document_id", "submission_id") REFERENCES "document_submissions"("application_document_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_review_history" ADD CONSTRAINT "document_review_history_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "in_app_notifications" ADD CONSTRAINT "in_app_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_applications" ADD CONSTRAINT "notification_applications_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "in_app_notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_applications" ADD CONSTRAINT "notification_applications_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_documents" ADD CONSTRAINT "notification_documents_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "in_app_notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_documents" ADD CONSTRAINT "notification_documents_application_document_id_fkey" FOREIGN KEY ("application_document_id") REFERENCES "application_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log_values" ADD CONSTRAINT "audit_log_values_audit_log_id_fkey" FOREIGN KEY ("audit_log_id") REFERENCES "audit_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_intents" ADD CONSTRAINT "upload_intents_application_document_id_fkey" FOREIGN KEY ("application_document_id") REFERENCES "application_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_intents" ADD CONSTRAINT "upload_intents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_intents" ADD CONSTRAINT "upload_intents_application_document_id_result_submission_i_fkey" FOREIGN KEY ("application_document_id", "result_submission_id") REFERENCES "document_submissions"("application_document_id", "id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Sprint 0 invariant checks that are not expressible in Prisma schema syntax.
ALTER TABLE "camp_settings"
  ADD CONSTRAINT "camp_settings_singleton_key_check" CHECK ("singleton_key" = 1),
  ADD CONSTRAINT "camp_settings_capacity_positive_check" CHECK ("capacity" > 0),
  ADD CONSTRAINT "camp_settings_version_positive_check" CHECK ("version" > 0),
  ADD CONSTRAINT "camp_settings_registration_window_check" CHECK ("registration_closes_at" > "registration_opens_at"),
  ADD CONSTRAINT "camp_settings_camp_window_check" CHECK ("ends_at" > "starts_at"),
  ADD CONSTRAINT "camp_settings_correction_deadline_check" CHECK ("correction_closes_at" IS NULL OR "correction_closes_at" >= "registration_closes_at");

ALTER TABLE "application_fields"
  ADD CONSTRAINT "application_fields_display_order_nonnegative_check" CHECK ("display_order" >= 0);

ALTER TABLE "application_field_options"
  ADD CONSTRAINT "application_field_options_display_order_nonnegative_check" CHECK ("display_order" >= 0);

ALTER TABLE "document_types"
  ADD CONSTRAINT "document_types_max_size_positive_check" CHECK ("max_size_bytes" > 0),
  ADD CONSTRAINT "document_types_max_count_check" CHECK ("max_count" = 1),
  ADD CONSTRAINT "document_types_max_replacements_nonnegative_check" CHECK ("max_replacements" >= 0),
  ADD CONSTRAINT "document_types_display_order_nonnegative_check" CHECK ("display_order" >= 0);

ALTER TABLE "applications"
  ADD CONSTRAINT "applications_version_positive_check" CHECK ("version" > 0),
  ADD CONSTRAINT "applications_draft_lifecycle_check" CHECK (
    ("status" = 'draft' AND "application_code" IS NULL AND "submitted_at" IS NULL)
    OR ("status" <> 'draft' AND "application_code" IS NOT NULL AND "submitted_at" IS NOT NULL AND "privacy_acknowledged_at" IS NOT NULL)
  );

ALTER TABLE "application_documents"
  ADD CONSTRAINT "application_documents_version_positive_check" CHECK ("version" > 0),
  ADD CONSTRAINT "application_documents_replacement_count_nonnegative_check" CHECK ("replacement_count" >= 0),
  ADD CONSTRAINT "application_documents_pointer_status_check" CHECK (
    ("status" = 'not_uploaded' AND "current_submission_id" IS NULL)
    OR ("status" <> 'not_uploaded' AND "current_submission_id" IS NOT NULL)
  ),
  ADD CONSTRAINT "application_documents_failure_message_check" CHECK (
    "status" NOT IN ('correction_required', 'rejected')
    OR btrim(coalesce("applicant_message", '')) <> ''
  );

ALTER TABLE "document_submissions"
  ADD CONSTRAINT "document_submissions_version_positive_check" CHECK ("version_number" > 0),
  ADD CONSTRAINT "document_submissions_size_positive_check" CHECK ("size_bytes" > 0),
  ADD CONSTRAINT "document_submissions_storage_key_nonblank_check" CHECK (btrim("storage_key") <> ''),
  ADD CONSTRAINT "document_submissions_checksum_nonblank_check" CHECK (btrim("checksum") <> '');

ALTER TABLE "document_review_history"
  ADD CONSTRAINT "document_review_history_version_positive_check" CHECK ("document_version" > 0),
  ADD CONSTRAINT "document_review_history_status_check" CHECK ("status" IN ('approved', 'correction_required', 'rejected')),
  ADD CONSTRAINT "document_review_history_failure_message_check" CHECK (
    "status" = 'approved' OR btrim("applicant_message") <> ''
  ),
  ADD CONSTRAINT "document_review_history_document_version_unique" UNIQUE ("application_document_id", "document_version");

ALTER TABLE "upload_intents"
  ADD CONSTRAINT "upload_intents_base_version_positive_check" CHECK ("base_document_version" > 0),
  ADD CONSTRAINT "upload_intents_configuration_version_positive_check" CHECK ("configuration_version" > 0),
  ADD CONSTRAINT "upload_intents_declared_size_positive_check" CHECK ("declared_size_bytes" > 0),
  ADD CONSTRAINT "upload_intents_expiry_after_creation_check" CHECK ("expires_at" > "created_at"),
  ADD CONSTRAINT "upload_intents_completion_fields_check" CHECK (
    ("status" = 'completed' AND "result_submission_id" IS NOT NULL AND "completed_at" IS NOT NULL)
    OR ("status" <> 'completed' AND "result_submission_id" IS NULL AND "completed_at" IS NULL)
  );

ALTER TABLE "idempotency_records"
  ADD CONSTRAINT "idempotency_records_application_version_positive_check" CHECK ("result_application_version" IS NULL OR "result_application_version" > 0),
  ADD CONSTRAINT "idempotency_records_document_version_positive_check" CHECK ("result_document_version" IS NULL OR "result_document_version" > 0);

CREATE OR REPLACE FUNCTION validate_answer_option_set(answer_id_to_validate UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  answer_field_id UUID;
  answer_data_type "ApplicationFieldType";
  answer_text_value TEXT;
  option_count INTEGER;
  foreign_option_count INTEGER;
BEGIN
  SELECT answer.field_id, field.data_type, answer.answer_text
    INTO answer_field_id, answer_data_type, answer_text_value
    FROM "application_answers" AS answer
    JOIN "application_fields" AS field ON field.id = answer.field_id
   WHERE answer.id = answer_id_to_validate;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT count(*)::INTEGER,
         count(*) FILTER (WHERE option.field_id <> answer_field_id)::INTEGER
    INTO option_count, foreign_option_count
    FROM "application_answer_options" AS selected
    JOIN "application_field_options" AS option ON option.id = selected.option_id
   WHERE selected.answer_id = answer_id_to_validate;

  IF foreign_option_count > 0 THEN
    RAISE EXCEPTION 'Selected option must belong to the answer field';
  END IF;

  IF answer_data_type NOT IN ('single_choice', 'multi_choice') AND option_count > 0 THEN
    RAISE EXCEPTION 'Non-choice answers cannot have selected options';
  END IF;

  IF answer_data_type IN ('single_choice', 'multi_choice') AND answer_text_value IS NOT NULL THEN
    RAISE EXCEPTION 'Choice answers cannot store scalar answer text';
  END IF;

  IF answer_data_type = 'single_choice' AND option_count > 1 THEN
    RAISE EXCEPTION 'Single-choice answers can select only one option';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION validate_answer_option_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  answer_id_to_validate UUID;
BEGIN
  answer_id_to_validate := CASE WHEN TG_OP = 'DELETE' THEN OLD.answer_id ELSE NEW.answer_id END;
  PERFORM validate_answer_option_set(answer_id_to_validate);
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER application_answer_options_membership_trigger
AFTER INSERT OR UPDATE OR DELETE ON "application_answer_options"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_answer_option_trigger();

CREATE OR REPLACE FUNCTION validate_answer_row_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM validate_answer_option_set(CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END);
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER application_answers_option_shape_trigger
AFTER INSERT OR UPDATE OR DELETE ON "application_answers"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_answer_row_trigger();

CREATE OR REPLACE FUNCTION validate_field_option_membership_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  answer_record RECORD;
BEGIN
  FOR answer_record IN
    SELECT DISTINCT selected.answer_id
      FROM "application_answer_options" AS selected
     WHERE selected.option_id = CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END
  LOOP
    PERFORM validate_answer_option_set(answer_record.answer_id);
  END LOOP;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER application_field_options_membership_trigger
AFTER UPDATE OR DELETE ON "application_field_options"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_field_option_membership_trigger();

CREATE OR REPLACE FUNCTION validate_field_answer_shape_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  answer_record RECORD;
BEGIN
  FOR answer_record IN
    SELECT id FROM "application_answers" WHERE field_id = NEW.id
  LOOP
    PERFORM validate_answer_option_set(answer_record.id);
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER application_field_answer_shape_trigger
AFTER UPDATE ON "application_fields"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_field_answer_shape_trigger();

CREATE OR REPLACE FUNCTION validate_document_review_version_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  stored_version INTEGER;
BEGIN
  SELECT version_number
    INTO stored_version
    FROM "document_submissions"
   WHERE id = NEW.submission_id
     AND application_document_id = NEW.application_document_id;

  IF stored_version IS NULL OR stored_version <> NEW.document_version THEN
    RAISE EXCEPTION 'Document review version must match the reviewed submission';
  END IF;

  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER document_review_version_trigger
AFTER INSERT OR UPDATE ON "document_review_history"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_document_review_version_trigger();

CREATE OR REPLACE FUNCTION prevent_camp_settings_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'The camp settings singleton cannot be deleted';
END;
$$;

CREATE TRIGGER camp_settings_delete_guard
BEFORE DELETE ON "camp_settings"
FOR EACH ROW EXECUTE FUNCTION prevent_camp_settings_delete();
