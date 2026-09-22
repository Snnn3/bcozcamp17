import { describe, expect, it } from "vitest";
import type { AuthenticatedPrincipal } from "@bcoz/auth";
import { StorageObjectReference, type PrivateObjectStorage } from "@bcoz/storage";
import { canReadPrivateDocument } from "../../apps/server/src/policies/storage";
import { issueAuthorizedDocumentDownload } from "../../apps/server/src/services/storage-access";

const ownerUserId = "00000000-0000-0000-0000-000000000001";
const otherUserId = "00000000-0000-0000-000000000002";
const documentReference = StorageObjectReference.immutableVersion(
  ownerUserId,
  "00000000-0000-0000-000000000010",
  "00000000-0000-0000-000000000011",
  1,
);

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
  createUploadUrl: async () => {
    throw new Error("upload signing is not part of this test");
  },
  createDownloadUrl: async ({ reference }) =>
    `https://storage.example/signed/${encodeURIComponent(reference.key)}`,
};

describe("authorized private document access", () => {
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
