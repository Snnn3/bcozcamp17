import { describe, expect, it } from "vitest";
import {
  createPrivateObjectStorage,
  StorageObjectReference,
  UploadMetadataValidationError,
  validatePrivateStorageOptions,
  validateUploadMetadata,
  type UploadValidationPolicy,
} from "@bcoz/storage";

const ownerUserId = "00000000-0000-0000-0000-000000000001";
const uploadPolicy: UploadValidationPolicy = {
  maxBytes: 5_000_000,
  allowedContentTypes: ["application/pdf", "image/jpeg"],
  allowedExtensions: [".pdf", ".jpg", ".jpeg"],
};

describe("private storage authorization boundary", () => {
  const storage = createPrivateObjectStorage({
    bucket: "bcoz-private",
    region: "us-east-1",
    endpoint: "http://localhost:9000",
    accessKeyId: "test-access-key",
    secretAccessKey: "test-secret-key",
    forcePathStyle: true,
  });

  it("signs server-issued staging references only for their owner", async () => {
    const reference = StorageObjectReference.staging(ownerUserId, "upload-intent-1");
    const url = await storage.createUploadUrl({
      reference,
      ownerUserId,
      metadata: {
        fileName: "transcript.pdf",
        contentType: "application/pdf",
        sizeBytes: 1_024,
      },
      policy: uploadPolicy,
    });

    expect(url).toContain("upload-intent-1");
    expect(url).toContain("X-Amz-Expires=600");
    await expect(
      storage.createUploadUrl({
        reference,
        ownerUserId,
        metadata: {
          fileName: "transcript.pdf",
          contentType: "application/pdf",
          sizeBytes: 1_024,
        },
        policy: uploadPolicy,
        expiresInSeconds: 601,
      }),
    ).rejects.toThrow("between 1 and 600 seconds");
    await expect(
      storage.createUploadUrl({
        reference,
        ownerUserId: "00000000-0000-0000-0000-000000000002",
        metadata: {
          fileName: "transcript.pdf",
          contentType: "application/pdf",
          sizeBytes: 1_024,
        },
        policy: uploadPolicy,
      }),
    ).rejects.toThrow("not authorized");
  });

  it("uses one-minute download URLs and rejects overlong lifetimes", async () => {
    const reference = StorageObjectReference.immutableVersion(
      ownerUserId,
      "00000000-0000-0000-0000-000000000010",
      "00000000-0000-0000-0000-000000000011",
      1,
    );
    const url = await storage.createDownloadUrl({ reference, ownerUserId });

    expect(url).toContain("X-Amz-Expires=60");
    await expect(
      storage.createDownloadUrl({ reference, ownerUserId, expiresInSeconds: 61 }),
    ).rejects.toThrow("between 1 and 60 seconds");
    await expect(
      storage.createUploadUrl({
        reference,
        ownerUserId,
        metadata: {
          fileName: "transcript.pdf",
          contentType: "application/pdf",
          sizeBytes: 1_024,
        },
        policy: uploadPolicy,
      }),
    ).rejects.toThrow("not authorized");
  });

  it("uses immutable owner-scoped version keys", () => {
    const versionOne = StorageObjectReference.immutableVersion(
      ownerUserId,
      "00000000-0000-0000-000000000010",
      "00000000-0000-0000-000000000011",
      1,
    );
    const versionTwo = StorageObjectReference.immutableVersion(
      ownerUserId,
      "00000000-0000-0000-000000000010",
      "00000000-0000-0000-000000000012",
      2,
    );

    expect(versionOne.key).toBe(
      `immutable/${ownerUserId}/00000000-0000-0000-000000000010/00000000-0000-0000-000000000011/v1`,
    );
    expect(versionTwo.key).not.toBe(versionOne.key);
  });

  it("validates file name, MIME type, extension, and size before signing", () => {
    expect(
      validateUploadMetadata(
        {
          fileName: "Transcript.PDF",
          contentType: "APPLICATION/PDF",
          sizeBytes: 1_024,
        },
        uploadPolicy,
      ),
    ).toEqual({
      fileName: "Transcript.PDF",
      contentType: "application/pdf",
      sizeBytes: 1_024,
      fileExtension: ".pdf",
    });

    expect(() =>
      validateUploadMetadata(
        { fileName: "transcript.exe", contentType: "application/pdf", sizeBytes: 1_024 },
        uploadPolicy,
      ),
    ).toThrow(UploadMetadataValidationError);
    expect(() =>
      validateUploadMetadata(
        { fileName: "transcript.pdf", contentType: "application/octet-stream", sizeBytes: 1_024 },
        uploadPolicy,
      ),
    ).toThrow("FILE_TYPE_NOT_ALLOWED");
    expect(() =>
      validateUploadMetadata(
        { fileName: "transcript.pdf", contentType: "application/pdf", sizeBytes: 5_000_001 },
        uploadPolicy,
      ),
    ).toThrow("FILE_TOO_LARGE");
    expect(() =>
      validateUploadMetadata(
        {
          fileName: "transcript.pdf",
          contentType: "application/pdf",
          detectedContentType: "image/jpeg",
          sizeBytes: 1_024,
        },
        uploadPolicy,
      ),
    ).toThrow("detected content type");
    expect(() =>
      validateUploadMetadata(
        { fileName: "transcript.pdf", contentType: "application/pdf", sizeBytes: 0 },
        uploadPolicy,
      ),
    ).toThrow("positive safe integer");
  });

  it("rejects incomplete storage credentials and unsafe bucket names", () => {
    expect(() =>
      validatePrivateStorageOptions({
        bucket: "bcoz-private",
        region: "us-east-1",
        accessKeyId: "only-access-key",
      }),
    ).toThrow("provided together");
    expect(() =>
      validatePrivateStorageOptions({
        bucket: "Bcoz Private",
        region: "us-east-1",
      }),
    ).toThrow("bucket");
    expect(() =>
      validatePrivateStorageOptions({
        bucket: "bcoz-private",
        region: "us-east-1",
        accessKeyId: "",
        secretAccessKey: "",
      }),
    ).toThrow("must not be blank");
  });
});
