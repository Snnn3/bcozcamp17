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
  contentType: string;
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

export function createPrivateObjectStorage(options: PrivateStorageOptions): PrivateObjectStorage {
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
      return getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: options.bucket,
          Key: input.reference.key,
          ContentType: input.contentType,
        }),
        {
          expiresIn: validateTtl(
            input.expiresInSeconds,
            STORAGE_UPLOAD_URL_DEFAULT_TTL_SECONDS,
            STORAGE_UPLOAD_URL_MAX_TTL_SECONDS,
          ),
        },
      );
    },
    async createDownloadUrl(input: CreateDownloadUrlInput): Promise<string> {
      assertAuthorizedReference(input.reference, input.ownerUserId, "immutable_version");
      return getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: options.bucket, Key: input.reference.key }),
        {
          expiresIn: validateTtl(
            input.expiresInSeconds,
            STORAGE_DOWNLOAD_URL_DEFAULT_TTL_SECONDS,
            STORAGE_DOWNLOAD_URL_MAX_TTL_SECONDS,
          ),
        },
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
