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

export interface CreateUploadUrlInput {
  key: string;
  contentType: string;
  expiresInSeconds?: number;
}

export interface CreateDownloadUrlInput {
  key: string;
  expiresInSeconds?: number;
}

export interface PrivateObjectStorage {
  createUploadUrl(input: CreateUploadUrlInput): Promise<string>;
  createDownloadUrl(input: CreateDownloadUrlInput): Promise<string>;
}

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
      return getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: options.bucket,
          Key: input.key,
          ContentType: input.contentType,
        }),
        { expiresIn: input.expiresInSeconds ?? 300 },
      );
    },
    async createDownloadUrl(input: CreateDownloadUrlInput): Promise<string> {
      return getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: options.bucket, Key: input.key }),
        { expiresIn: input.expiresInSeconds ?? 300 },
      );
    },
  };
}
