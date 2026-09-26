import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadEnvironmentFile, parseEnvironment } from "@bcoz/config";

describe("environment setup", () => {
  it("loads the documented env file and exposes server configuration to parsing", async () => {
    const directory = await mkdtemp(join(tmpdir(), "bcoz-env-"));
    const filePath = join(directory, ".env");
    const originalClientId = process.env.GOOGLE_CLIENT_ID;
    const originalRedirectUri = process.env.GOOGLE_REDIRECT_URI;

    try {
      await writeFile(
        filePath,
        "GOOGLE_CLIENT_ID=smoke-client\nGOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback\n",
        "utf8",
      );
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_REDIRECT_URI;
      loadEnvironmentFile(filePath);

      const environment = parseEnvironment(process.env);
      expect(environment.googleClientId).toBe("smoke-client");
      expect(environment.googleRedirectUri).toBe("http://localhost:3000/auth/google/callback");
      expect(await readFile(filePath, "utf8")).toContain("GOOGLE_CLIENT_ID=smoke-client");
    } finally {
      if (originalClientId === undefined) {
        delete process.env.GOOGLE_CLIENT_ID;
      } else {
        process.env.GOOGLE_CLIENT_ID = originalClientId;
      }
      if (originalRedirectUri === undefined) {
        delete process.env.GOOGLE_REDIRECT_URI;
      } else {
        process.env.GOOGLE_REDIRECT_URI = originalRedirectUri;
      }
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("treats blank optional Google placeholders as unset", () => {
    const environment = parseEnvironment({
      ...process.env,
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
      GOOGLE_REDIRECT_URI: "",
    });

    expect(environment.googleClientId).toBeUndefined();
    expect(environment.googleClientSecret).toBeUndefined();
    expect(environment.googleRedirectUri).toBeUndefined();
  });

  it("parses storage path-style configuration without treating false as true", () => {
    const environment = parseEnvironment({
      ...process.env,
      STORAGE_FORCE_PATH_STYLE: "false",
    });

    expect(environment.storageForcePathStyle).toBe(false);
  });

  it("requires storage credentials to be supplied as a pair", () => {
    expect(() =>
      parseEnvironment({
        ...process.env,
        STORAGE_ACCESS_KEY_ID: "only-access-key",
        STORAGE_SECRET_ACCESS_KEY: "",
      }),
    ).toThrow("provided together");
  });

  it("rejects unsafe storage bucket names", () => {
    expect(() =>
      parseEnvironment({
        ...process.env,
        STORAGE_BUCKET: "Bcoz Private",
      }),
    ).toThrow();
  });

  it("normalizes exact browser origins and rejects paths", () => {
    expect(
      parseEnvironment({
        ...process.env,
        WEB_ORIGINS: "http://localhost:5173/",
      }).webOrigins,
    ).toEqual(["http://localhost:5173"]);
    expect(() =>
      parseEnvironment({
        ...process.env,
        WEB_ORIGINS: "http://localhost:5173/app",
      }),
    ).toThrow("exact origins");
    for (const unsafeOrigin of [
      "http://localhost:5173?tab=home",
      "http://localhost:5173#fragment",
      "http://user:secret@localhost:5173",
      "//localhost:5173",
    ]) {
      expect(() => parseEnvironment({ ...process.env, WEB_ORIGINS: unsafeOrigin })).toThrow();
    }
  });

  it("requires explicit HTTPS origins and virtual-hosted storage in production", () => {
    expect(() =>
      parseEnvironment({
        ...process.env,
        NODE_ENV: "production",
        STORAGE_FORCE_PATH_STYLE: "true",
        WEB_ORIGINS: "https://app.example.test",
      }),
    ).toThrow("explicitly false");
    expect(() =>
      parseEnvironment({
        ...process.env,
        NODE_ENV: "production",
        STORAGE_FORCE_PATH_STYLE: "false",
        WEB_ORIGINS: "http://app.example.test",
      }),
    ).toThrow("WEB_ORIGINS must use HTTPS");
  });

  it("rejects storage endpoint credentials and whitespace-only secrets centrally", () => {
    expect(() =>
      parseEnvironment({
        ...process.env,
        STORAGE_ENDPOINT: "https://user:secret@storage.example.test",
      }),
    ).toThrow("STORAGE_ENDPOINT");
    expect(() =>
      parseEnvironment({
        ...process.env,
        STORAGE_ACCESS_KEY_ID: "   ",
        STORAGE_SECRET_ACCESS_KEY: "secret",
      }),
    ).toThrow("provided together");
  });
});
