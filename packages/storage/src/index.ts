import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface PrivateStorageOptions {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle?: boolean;
}

export type StorageObjectKind = "staging" | "immutable_version";

export interface UploadMetadata {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  detectedContentType?: string;
}

export interface UploadValidationPolicy {
  maxBytes: number;
  allowedContentTypes: readonly string[];
  allowedExtensions: readonly string[];
}

export interface ValidatedUploadMetadata extends UploadMetadata {
  fileExtension: string;
}

export type UploadValidationCode = "FILE_INVALID" | "FILE_TYPE_NOT_ALLOWED" | "FILE_TOO_LARGE";

export class UploadMetadataValidationError extends Error {
  public constructor(
    public readonly code: UploadValidationCode,
    message: string,
  ) {
    super(`[${code}] ${message}`);
    this.name = "UploadMetadataValidationError";
  }
}

const BUCKET_NAME_PATTERN =
  /^(?=.{3,63}$)(?!\d{1,3}(?:\.\d{1,3}){3}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;
const CONTENT_TYPE_PATTERN = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/;
const FILE_NAME_MAX_LENGTH = 255;

export function validatePrivateStorageOptions(options: PrivateStorageOptions): void {
  if (!BUCKET_NAME_PATTERN.test(options.bucket)) {
    throw new Error("STORAGE_BUCKET must be a valid object-storage bucket name.");
  }
  if (options.region.trim() === "") {
    throw new Error("STORAGE_REGION must not be blank.");
  }
  if (options.endpoint !== undefined) {
    let endpoint: URL;
    try {
      endpoint = new URL(options.endpoint);
    } catch {
      throw new Error("STORAGE_ENDPOINT must be a valid URL.");
    }
    if (endpoint.protocol !== "http:" && endpoint.protocol !== "https:") {
      throw new Error("STORAGE_ENDPOINT must use HTTP or HTTPS.");
    }
    if (endpoint.username !== "" || endpoint.password !== "" || endpoint.hash !== "") {
      throw new Error("STORAGE_ENDPOINT must not contain credentials or a fragment.");
    }
  }

  const hasAccessKey = options.accessKeyId !== undefined;
  const hasSecretKey = options.secretAccessKey !== undefined;
  if (hasAccessKey !== hasSecretKey) {
    throw new Error(
      "STORAGE_ACCESS_KEY_ID and STORAGE_SECRET_ACCESS_KEY must be provided together.",
    );
  }
  if (
    (hasAccessKey && options.accessKeyId?.trim() === "") ||
    (hasSecretKey && options.secretAccessKey?.trim() === "")
  ) {
    throw new Error("Storage credentials must not be blank.");
  }
  if (options.forcePathStyle !== undefined && typeof options.forcePathStyle !== "boolean") {
    throw new Error("STORAGE_FORCE_PATH_STYLE must be a boolean.");
  }
}

export function validateUploadMetadata(
  metadata: UploadMetadata,
  policy: UploadValidationPolicy,
): ValidatedUploadMetadata {
  const fileName = metadata.fileName.trim();
  if (
    fileName.length === 0 ||
    fileName.length > FILE_NAME_MAX_LENGTH ||
    /[\\/]/.test(fileName) ||
    containsControlCharacter(fileName)
  ) {
    throw new UploadMetadataValidationError(
      "FILE_INVALID",
      "The file name is invalid for an upload.",
    );
  }

  if (!Number.isSafeInteger(metadata.sizeBytes) || metadata.sizeBytes < 1) {
    throw new UploadMetadataValidationError(
      "FILE_INVALID",
      "The file size must be a positive safe integer.",
    );
  }
  if (!Number.isSafeInteger(policy.maxBytes) || policy.maxBytes < 1) {
    throw new UploadMetadataValidationError("FILE_INVALID", "The upload size policy is invalid.");
  }
  if (metadata.sizeBytes > policy.maxBytes) {
    throw new UploadMetadataValidationError(
      "FILE_TOO_LARGE",
      `The file exceeds the ${policy.maxBytes}-byte upload limit.`,
    );
  }

  const contentType = normalizeContentType(metadata.contentType);
  const allowedContentTypes = policy.allowedContentTypes.map(normalizeContentType);
  if (!allowedContentTypes.includes(contentType)) {
    throw new UploadMetadataValidationError(
      "FILE_TYPE_NOT_ALLOWED",
      `The content type ${contentType} is not allowed.`,
    );
  }

  const detectedContentType =
    metadata.detectedContentType === undefined
      ? undefined
      : normalizeContentType(metadata.detectedContentType);
  if (detectedContentType !== undefined && detectedContentType !== contentType) {
    throw new UploadMetadataValidationError(
      "FILE_TYPE_NOT_ALLOWED",
      "The detected content type does not match the declared content type.",
    );
  }

  const fileExtension = getFileExtension(fileName);
  const allowedExtensions = policy.allowedExtensions.map(normalizeExtension);
  if (fileExtension === undefined || !allowedExtensions.includes(fileExtension)) {
    throw new UploadMetadataValidationError(
      "FILE_TYPE_NOT_ALLOWED",
      "The file extension is not allowed.",
    );
  }

  return {
    fileName,
    contentType,
    sizeBytes: metadata.sizeBytes,
    fileExtension,
    ...(detectedContentType === undefined ? {} : { detectedContentType }),
  };
}

export class StorageObjectReference {
  private constructor(
    public readonly kind: StorageObjectKind,
    public readonly ownerUserId: string,
    public readonly key: string,
  ) {}

  public static staging(ownerUserId: string, uploadIntentId: string): StorageObjectReference {
    const owner = validatePathSegment(ownerUserId, "ownerUserId");
    const intent = validatePathSegment(uploadIntentId, "uploadIntentId");
    return new StorageObjectReference("staging", owner, `staging/${owner}/${intent}`);
  }

  public static immutableVersion(
    ownerUserId: string,
    applicationDocumentId: string,
    submissionId: string,
    versionNumber: number,
  ): StorageObjectReference {
    const owner = validatePathSegment(ownerUserId, "ownerUserId");
    const document = validatePathSegment(applicationDocumentId, "applicationDocumentId");
    const submission = validatePathSegment(submissionId, "submissionId");
    if (!Number.isSafeInteger(versionNumber) || versionNumber < 1) {
      throw new Error("versionNumber must be a positive safe integer.");
    }
    return new StorageObjectReference(
      "immutable_version",
      owner,
      `immutable/${owner}/${document}/${submission}/v${versionNumber}`,
    );
  }
}

export interface CreateUploadUrlInput {
  reference: StorageObjectReference;
  ownerUserId: string;
  metadata: UploadMetadata;
  policy: UploadValidationPolicy;
  expiresInSeconds?: number;
}

export interface CreateDownloadUrlInput {
  reference: StorageObjectReference;
  ownerUserId: string;
  expiresInSeconds?: number;
}

export interface PrivateObjectStorage {
  createUploadUrl(input: CreateUploadUrlInput): Promise<string>;
  createDownloadUrl(input: CreateDownloadUrlInput): Promise<string>;
}

export const STORAGE_UPLOAD_URL_DEFAULT_TTL_SECONDS = 300;
export const STORAGE_UPLOAD_URL_MAX_TTL_SECONDS = 300;
export const STORAGE_DOWNLOAD_URL_DEFAULT_TTL_SECONDS = 60;
export const STORAGE_DOWNLOAD_URL_MAX_TTL_SECONDS = 60;

export function resolveUploadUrlTtl(value: number | undefined): number {
  return validateTtl(
    value,
    STORAGE_UPLOAD_URL_DEFAULT_TTL_SECONDS,
    STORAGE_UPLOAD_URL_MAX_TTL_SECONDS,
  );
}

export function resolveDownloadUrlTtl(value: number | undefined): number {
  return validateTtl(
    value,
    STORAGE_DOWNLOAD_URL_DEFAULT_TTL_SECONDS,
    STORAGE_DOWNLOAD_URL_MAX_TTL_SECONDS,
  );
}

export function createPrivateObjectStorage(options: PrivateStorageOptions): PrivateObjectStorage {
  validatePrivateStorageOptions(options);
  const credentials =
    options.accessKeyId !== undefined && options.secretAccessKey !== undefined
      ? { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey }
      : undefined;

  const client = new S3Client({
    region: options.region,
    ...(options.endpoint === undefined ? {} : { endpoint: options.endpoint }),
    ...(credentials === undefined ? {} : { credentials }),
    forcePathStyle: options.forcePathStyle ?? true,
  });

  return {
    async createUploadUrl(input: CreateUploadUrlInput): Promise<string> {
      assertAuthorizedReference(input.reference, input.ownerUserId, "staging");
      const metadata = validateUploadMetadata(input.metadata, input.policy);
      return getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: options.bucket,
          Key: input.reference.key,
          ContentType: metadata.contentType,
          ContentLength: metadata.sizeBytes,
        }),
        { expiresIn: resolveUploadUrlTtl(input.expiresInSeconds) },
      );
    },
    async createDownloadUrl(input: CreateDownloadUrlInput): Promise<string> {
      assertAuthorizedReference(input.reference, input.ownerUserId, "immutable_version");
      return getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: options.bucket, Key: input.reference.key }),
        { expiresIn: resolveDownloadUrlTtl(input.expiresInSeconds) },
      );
    },
  };
}

function validatePathSegment(value: string, name: string): string {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw new Error(`${name} must be a safe storage path segment.`);
  }
  return value;
}

function assertAuthorizedReference(
  reference: StorageObjectReference,
  ownerUserId: string,
  expectedKind: StorageObjectKind,
): void {
  if (!(reference instanceof StorageObjectReference)) {
    throw new Error("Storage object references must be issued by the server.");
  }
  if (reference.kind !== expectedKind || reference.ownerUserId !== ownerUserId) {
    throw new Error("The storage object is not authorized for this operation.");
  }
}

function validateTtl(value: number | undefined, defaultValue: number, maximum: number): number {
  const ttl = value ?? defaultValue;
  if (!Number.isInteger(ttl) || ttl < 1 || ttl > maximum) {
    throw new Error(`Signed URL lifetime must be an integer between 1 and ${maximum} seconds.`);
  }
  return ttl;
}

function normalizeContentType(value: string): string {
  const contentType = value.trim().toLowerCase();
  if (!CONTENT_TYPE_PATTERN.test(contentType)) {
    throw new UploadMetadataValidationError(
      "FILE_INVALID",
      "The declared content type is invalid.",
    );
  }
  return contentType;
}

function normalizeExtension(value: string): string {
  const extension = value.trim().toLowerCase();
  const normalized = extension.startsWith(".") ? extension : `.${extension}`;
  if (!/^\.[a-z0-9]{1,16}$/.test(normalized)) {
    throw new UploadMetadataValidationError(
      "FILE_INVALID",
      "The upload extension policy is invalid.",
    );
  }
  return normalized;
}

function getFileExtension(fileName: string): string | undefined {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === fileName.length - 1) {
    return undefined;
  }
  const extension = fileName.slice(lastDot).toLowerCase();
  return /^\.[a-z0-9]{1,16}$/.test(extension) ? extension : undefined;
}

function containsControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.charCodeAt(0);
    if (codePoint < 0x20 || codePoint === 0x7f) {
      return true;
    }
  }
  return false;
}
