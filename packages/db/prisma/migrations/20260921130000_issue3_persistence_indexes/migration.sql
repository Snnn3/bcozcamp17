-- Align the Prisma schema with the persistence contract indexes.
ALTER TABLE "camp_settings"
  ALTER COLUMN "singleton_key" TYPE SMALLINT
  USING "singleton_key"::SMALLINT;

CREATE INDEX "application_fields_display_order_idx"
  ON "application_fields"("display_order");

CREATE INDEX "application_field_options_display_order_idx"
  ON "application_field_options"("display_order");

CREATE INDEX "applications_status_idx"
  ON "applications"("status");

CREATE INDEX "document_types_display_order_idx"
  ON "document_types"("display_order");

CREATE INDEX "application_documents_application_id_status_idx"
  ON "application_documents"("application_id", "status");

CREATE INDEX "document_review_history_submission_id_idx"
  ON "document_review_history"("submission_id");

CREATE INDEX "in_app_notifications_user_id_is_read_created_at_idx"
  ON "in_app_notifications"("user_id", "is_read", "created_at");

CREATE INDEX "notification_applications_application_id_notification_id_idx"
  ON "notification_applications"("application_id", "notification_id");

CREATE INDEX "notification_documents_application_document_id_notification_id_idx"
  ON "notification_documents"("application_document_id", "notification_id");

DROP INDEX "audit_logs_entity_type_entity_id_idx";

CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx"
  ON "audit_logs"("entity_type", "entity_id", "created_at");
