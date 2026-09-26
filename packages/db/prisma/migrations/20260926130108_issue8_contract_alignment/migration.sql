-- CreateEnum
CREATE TYPE "DocumentReviewStatus" AS ENUM ('approved', 'correction_required', 'rejected');

-- AlterTable
ALTER TABLE "document_review_history"
DROP CONSTRAINT "document_review_history_status_check",
DROP CONSTRAINT "document_review_history_failure_message_check";

ALTER TABLE "document_review_history"
ALTER COLUMN "status" TYPE "DocumentReviewStatus"
USING "status"::text::"DocumentReviewStatus";

ALTER TABLE "document_review_history"
ADD CONSTRAINT "document_review_history_failure_message_check" CHECK (
  "status" = 'approved' OR btrim("applicant_message") <> ''
);

-- RenameIndex
ALTER INDEX "document_review_history_document_version_unique" RENAME TO "document_review_history_application_document_id_document_ve_key";

-- RenameIndex
ALTER INDEX "notification_documents_application_document_id_notification_id_idx" RENAME TO "notification_documents_application_document_id_notification_idx";
