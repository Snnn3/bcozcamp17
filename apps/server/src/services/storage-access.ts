import type { AuthenticatedPrincipal } from "@bcoz/auth";
import {
  resolveDownloadUrlTtl,
  type PrivateObjectStorage,
  type StorageObjectReference,
} from "@bcoz/storage";
import { assertCanReadPrivateDocument } from "../policies/storage.js";

export interface AuthorizedDocumentDownload {
  downloadUrl: string;
  expiresAt: string;
}

export interface AuthorizedDocumentDownloadInput {
  principal: AuthenticatedPrincipal;
  ownerUserId: string;
  reference: StorageObjectReference;
  expiresInSeconds?: number;
  now?: () => Date;
}

export async function issueAuthorizedDocumentDownload(
  storage: PrivateObjectStorage,
  input: AuthorizedDocumentDownloadInput,
): Promise<AuthorizedDocumentDownload> {
  assertCanReadPrivateDocument(input.principal, input.ownerUserId);
  if (
    input.reference.kind !== "immutable_version" ||
    input.reference.ownerUserId !== input.ownerUserId
  ) {
    throw new Error("The storage object is not authorized for this operation.");
  }
  const expiresInSeconds = resolveDownloadUrlTtl(input.expiresInSeconds);
  const issuedAt = (input.now ?? (() => new Date()))();
  const downloadUrl = await storage.createDownloadUrl({
    reference: input.reference,
    ownerUserId: input.ownerUserId,
    expiresInSeconds,
  });

  return {
    downloadUrl,
    expiresAt: new Date(issuedAt.getTime() + expiresInSeconds * 1_000).toISOString(),
  };
}
