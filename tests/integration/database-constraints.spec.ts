import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";

const databaseTests = process.env.DATABASE_URL === undefined ? describe.skip : describe;

databaseTests("PostgreSQL lifecycle constraints", () => {
  const prisma = new PrismaClient();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects an invalid camp singleton value", async () => {
    await expect(
      prisma.$executeRaw`
        INSERT INTO camp_settings (
          id, singleton_key, name, status, timezone, capacity,
          registration_opens_at, registration_closes_at, starts_at, ends_at,
          privacy_notice_version, updated_at
        ) VALUES (
          ${randomUUID()}::uuid, 2, 'invalid', 'draft', 'Asia/Bangkok', 1,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 day',
          CURRENT_TIMESTAMP + INTERVAL '2 days', CURRENT_TIMESTAMP + INTERVAL '3 days',
          'test', CURRENT_TIMESTAMP
        )
      `,
    ).rejects.toThrow();
  });

  it("rejects a current submission that belongs to another document", async () => {
    const userId = randomUUID();
    const profileId = randomUUID();
    const applicationId = randomUUID();
    const firstTypeId = randomUUID();
    const secondTypeId = randomUUID();
    const firstDocumentId = randomUUID();
    const secondDocumentId = randomUUID();
    const submissionId = randomUUID();

    await prisma.$executeRaw`
      INSERT INTO users (id, google_subject, email, status, updated_at)
      VALUES (${userId}::uuid, ${`constraint-user-${userId}`}, ${`${userId}@example.test`}, 'active', CURRENT_TIMESTAMP)
    `;
    await prisma.$executeRaw`
      INSERT INTO participant_profiles (id, user_id, updated_at)
      VALUES (${profileId}::uuid, ${userId}::uuid, CURRENT_TIMESTAMP)
    `;
    await prisma.$executeRaw`
      INSERT INTO applications (id, participant_id, status, privacy_notice_version, updated_at)
      VALUES (${applicationId}::uuid, ${profileId}::uuid, 'draft', 'test', CURRENT_TIMESTAMP)
    `;
    await prisma.$executeRaw`
      INSERT INTO document_types (id, code, name, is_required, max_size_bytes, max_count, max_replacements, replacement_allowed, is_active, display_order)
      VALUES
        (${firstTypeId}::uuid, ${`first-${firstTypeId}`}, 'First', true, 1, 1, 0, true, true, 0),
        (${secondTypeId}::uuid, ${`second-${secondTypeId}`}, 'Second', true, 1, 1, 0, true, true, 1)
    `;
    await prisma.$executeRaw`
      INSERT INTO application_documents (id, application_id, document_type_id, status, replacement_allowed, updated_at)
      VALUES
        (${firstDocumentId}::uuid, ${applicationId}::uuid, ${firstTypeId}::uuid, 'not_uploaded', true, CURRENT_TIMESTAMP),
        (${secondDocumentId}::uuid, ${applicationId}::uuid, ${secondTypeId}::uuid, 'not_uploaded', true, CURRENT_TIMESTAMP)
    `;
    await prisma.$executeRaw`
      INSERT INTO document_submissions (
        id, application_document_id, version_number, storage_key, original_filename,
        mime_type, size_bytes, checksum, uploaded_by
      ) VALUES (
        ${submissionId}::uuid, ${secondDocumentId}::uuid, 1,
        ${`private/${submissionId}`}, 'test.pdf', 'application/pdf', 1, 'checksum', ${userId}::uuid
      )
    `;

    await expect(
      prisma.$executeRaw`
        UPDATE application_documents
           SET current_submission_id = ${submissionId}::uuid, status = 'pending'
         WHERE id = ${firstDocumentId}::uuid
      `,
    ).rejects.toThrow();
  });

  it("rejects a choice option from a different field", async () => {
    const userId = randomUUID();
    const profileId = randomUUID();
    const applicationId = randomUUID();
    const firstFieldId = randomUUID();
    const secondFieldId = randomUUID();
    const optionId = randomUUID();
    const answerId = randomUUID();

    await prisma.$executeRaw`
      INSERT INTO users (id, google_subject, email, status, updated_at)
      VALUES (${userId}::uuid, ${`choice-user-${userId}`}, ${`${userId}@example.test`}, 'active', CURRENT_TIMESTAMP)
    `;
    await prisma.$executeRaw`
      INSERT INTO participant_profiles (id, user_id, updated_at)
      VALUES (${profileId}::uuid, ${userId}::uuid, CURRENT_TIMESTAMP)
    `;
    await prisma.$executeRaw`
      INSERT INTO applications (id, participant_id, status, privacy_notice_version, updated_at)
      VALUES (${applicationId}::uuid, ${profileId}::uuid, 'draft', 'test', CURRENT_TIMESTAMP)
    `;
    await prisma.$executeRaw`
      INSERT INTO application_fields (id, field_code, label, data_type, is_required, is_active, display_order)
      VALUES
        (${firstFieldId}::uuid, ${`first-field-${firstFieldId}`}, 'First', 'single_choice', true, true, 0),
        (${secondFieldId}::uuid, ${`second-field-${secondFieldId}`}, 'Second', 'single_choice', true, true, 1)
    `;
    await prisma.$executeRaw`
      INSERT INTO application_field_options (id, field_id, option_code, label, display_order)
      VALUES (${optionId}::uuid, ${secondFieldId}::uuid, 'foreign', 'Foreign', 0)
    `;
    await prisma.$executeRaw`
      INSERT INTO application_answers (id, application_id, field_id, updated_at)
      VALUES (${answerId}::uuid, ${applicationId}::uuid, ${firstFieldId}::uuid, CURRENT_TIMESTAMP)
    `;

    await expect(
      prisma.$executeRaw`
        INSERT INTO application_answer_options (answer_id, option_id)
        VALUES (${answerId}::uuid, ${optionId}::uuid)
      `,
    ).rejects.toThrow();
  });
});
