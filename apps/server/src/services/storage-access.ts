import type { AuthenticatedPrincipal } from "@bcoz/auth";
import {
  resolveDownloadUrlTtl,
  resolveUploadUrlTtl,
  type PrivateObjectStorage,
  type StorageObjectReference,
  type UploadMetadata,
  type UploadValidationPolicy,
} from "@bcoz/storage";
import {
  assertCanReadPrivateDocument,
  assertCanUploadPrivateDocument,
} from "../policies/storage.js";

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

export interface AuthorizedDocumentUpload {
  uploadUrl: string;
  expiresAt: string;
}

export interface AuthorizedDocumentUploadInput {
  principal: AuthenticatedPrincipal;
  ownerUserId: string;
  reference: StorageObjectReference;
  metadata: UploadMetadata;
  policy: UploadValidationPolicy;
  expiresInSeconds?: number;
  now?: () => Date;
}

export async function issueAuthorizedDocumentUpload(
  storage: PrivateObjectStorage,
  input: AuthorizedDocumentUploadInput,
): Promise<AuthorizedDocumentUpload> {
  assertCanUploadPrivateDocument(input.principal, input.ownerUserId);
  if (input.reference.kind !== "staging" || input.reference.ownerUserId !== input.ownerUserId) {
    throw new Error("The storage object is not authorized for this operation.");
  }
  const expiresInSeconds = resolveUploadUrlTtl(input.expiresInSeconds);
  const issuedAt = (input.now ?? (() => new Date()))();
  const uploadUrl = await storage.createUploadUrl({
    reference: input.reference,
    ownerUserId: input.ownerUserId,
    metadata: input.metadata,
    policy: input.policy,
    expiresInSeconds,
  });

  return {
    uploadUrl,
    expiresAt: new Date(issuedAt.getTime() + expiresInSeconds * 1_000).toISOString(),
  };
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
