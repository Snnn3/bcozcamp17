import { describe, expect, it } from "vitest";
import type { AuthenticatedPrincipal } from "@bcoz/auth";
import { StorageObjectReference, type PrivateObjectStorage } from "@bcoz/storage";
import {
  canReadPrivateDocument,
  canUploadPrivateDocument,
} from "../../apps/server/src/policies/storage";
import {
  issueAuthorizedDocumentDownload,
  issueAuthorizedDocumentUpload,
} from "../../apps/server/src/services/storage-access";

const ownerUserId = "00000000-0000-0000-0000-000000000001";
const otherUserId = "00000000-0000-0000-000000000002";
const documentReference = StorageObjectReference.immutableVersion(
  ownerUserId,
  "00000000-0000-0000-000000000010",
  "00000000-0000-0000-000000000011",
  1,
);
const stagingReference = StorageObjectReference.staging(ownerUserId, "upload-intent-1");
const uploadPolicy = {
  maxBytes: 5_000_000,
  allowedContentTypes: ["application/pdf"],
  allowedExtensions: [".pdf"],
} as const;

const participant = {
  userId: ownerUserId,
  email: "participant@example.test",
  status: "active",
  roles: ["participant"],
  permissions: [],
} satisfies AuthenticatedPrincipal;

const staffWithDocumentRead = {
  userId: otherUserId,
  email: "staff@example.test",
  status: "active",
  roles: ["staff"],
  permissions: [
    { code: "application_read", effect: "allow" },
    { code: "document_read", effect: "allow" },
  ],
} satisfies AuthenticatedPrincipal;

const storage: PrivateObjectStorage = {
  createUploadUrl: async ({ reference }) =>
    "https://storage.example/upload/" + encodeURIComponent(reference.key),
  createDownloadUrl: async ({ reference }) =>
    `https://storage.example/signed/${encodeURIComponent(reference.key)}`,
};

describe("authorized private document access", () => {
  it("issues only a short-lived upload response for the document owner", async () => {
    const response = await issueAuthorizedDocumentUpload(storage, {
      principal: participant,
      ownerUserId,
      reference: stagingReference,
      metadata: {
        fileName: "transcript.pdf",
        contentType: "application/pdf",
        sizeBytes: 1_024,
      },
      policy: uploadPolicy,
      now: () => new Date("2026-09-22T00:00:00.000Z"),
    });

    expect(response).toEqual({
      uploadUrl: expect.stringContaining("upload"),
      expiresAt: "2026-09-22T00:10:00.000Z",
    });
    expect(response).not.toHaveProperty("storageKey");
  });

  it("issues only a short-lived download response for the document owner", async () => {
    const response = await issueAuthorizedDocumentDownload(storage, {
      principal: participant,
      ownerUserId,
      reference: documentReference,
      now: () => new Date("2026-09-22T00:00:00.000Z"),
    });

    expect(response).toEqual({
      downloadUrl: expect.stringContaining("signed"),
      expiresAt: "2026-09-22T00:01:00.000Z",
    });
    expect(response).not.toHaveProperty("storageKey");
  });

  it("allows staff only with both application and document read permissions", async () => {
    expect(canReadPrivateDocument(staffWithDocumentRead, ownerUserId)).toBe(true);
    await expect(
      issueAuthorizedDocumentDownload(storage, {
        principal: staffWithDocumentRead,
        ownerUserId,
        reference: documentReference,
        now: () => new Date("2026-09-22T00:00:00.000Z"),
      }),
    ).resolves.toHaveProperty("expiresAt", "2026-09-22T00:01:00.000Z");
  });

  it("denies another participant and staff without document permission", async () => {
    const anotherParticipant = {
      ...participant,
      userId: otherUserId,
    } satisfies AuthenticatedPrincipal;
    const staffWithoutDocumentRead = {
      ...staffWithDocumentRead,
      permissions: [{ code: "application_read", effect: "allow" }],
    } satisfies AuthenticatedPrincipal;

    expect(canReadPrivateDocument(anotherParticipant, ownerUserId)).toBe(false);
    expect(canReadPrivateDocument(staffWithoutDocumentRead, ownerUserId)).toBe(false);
    await expect(
      issueAuthorizedDocumentDownload(storage, {
        principal: anotherParticipant,
        ownerUserId,
        reference: documentReference,
      }),
    ).rejects.toThrow("not authorized");
    expect(canUploadPrivateDocument(staffWithDocumentRead, ownerUserId)).toBe(false);
    await expect(
      issueAuthorizedDocumentUpload(storage, {
        principal: staffWithDocumentRead,
        ownerUserId,
        reference: stagingReference,
        metadata: {
          fileName: "transcript.pdf",
          contentType: "application/pdf",
          sizeBytes: 1_024,
        },
        policy: uploadPolicy,
      }),
    ).rejects.toThrow("not authorized to upload");
  });

  it("denies disabled principals and explicit document-read denials", () => {
    const disabledOwner = {
      ...participant,
      status: "disabled",
    } satisfies AuthenticatedPrincipal;
    const deniedOwner = {
      ...participant,
      permissions: [{ code: "document_read", effect: "deny" }],
    } satisfies AuthenticatedPrincipal;

    expect(canReadPrivateDocument(disabledOwner, ownerUserId)).toBe(false);
    expect(canReadPrivateDocument(deniedOwner, ownerUserId)).toBe(false);
  });
});
