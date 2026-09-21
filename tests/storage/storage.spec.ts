import { describe, expect, it } from "vitest";
import { createPrivateObjectStorage, StorageObjectReference } from "@bcoz/storage";

const ownerUserId = "00000000-0000-0000-0000-000000000001";

describe("private storage authorization boundary", () => {
  const storage = createPrivateObjectStorage({
    bucket: "bcoz-private",
    region: "us-east-1",
    endpoint: "http://localhost:9000",
    accessKeyId: "test-access-key",
    secretAccessKey: "test-secret-key",
  });

  it("signs server-issued staging references only for their owner", async () => {
    const reference = StorageObjectReference.staging(ownerUserId, "upload-intent-1");
    const url = await storage.createUploadUrl({
      reference,
      ownerUserId,
      contentType: "application/pdf",
    });

    expect(url).toContain("upload-intent-1");
    await expect(
      storage.createUploadUrl({
        reference,
        ownerUserId: "00000000-0000-0000-0000-000000000002",
        contentType: "application/pdf",
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
        contentType: "application/pdf",
      }),
    ).rejects.toThrow("not authorized");
  });
});
