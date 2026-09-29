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

  it("requires a Supabase project URL for the Supabase auth phase", () => {
    expect(() =>
      parseEnvironment({
        ...process.env,
        AUTH_PHASE: "supabase",
        SUPABASE_URL: "",
      }),
    ).toThrow("SUPABASE_URL is required");

    const environment = parseEnvironment({
      ...process.env,
      AUTH_PHASE: "supabase",
      SUPABASE_URL: "https://project.supabase.co",
    });
    expect(environment.authPhase).toBe("supabase");
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
      "*",
      "localhost:5173",
      "http://localhost:5173?tab=home",
      "http://localhost:5173#fragment",
      "http://user:secret@localhost:5173",
      "//localhost:5173",
      "ftp://example.test/",
      "file:///tmp/bcoz",
    ]) {
      expect(() => parseEnvironment({ ...process.env, WEB_ORIGINS: unsafeOrigin })).toThrow();
    }
    for (const malformedOrigins of [
      "http://localhost:5173,",
      "http://localhost:5173,,http://localhost:5174",
    ]) {
      expect(() => parseEnvironment({ ...process.env, WEB_ORIGINS: malformedOrigins })).toThrow(
        "empty entries",
      );
    }
  });

  it("requires explicit HTTPS origins and virtual-hosted storage in production", () => {
    expect(() =>
      parseEnvironment({
        ...process.env,
        NODE_ENV: "production",
        AUTH_PHASE: "fastify",
        STORAGE_FORCE_PATH_STYLE: "true",
        WEB_ORIGINS: "https://app.example.test",
      }),
    ).toThrow("explicitly false");
    expect(() =>
      parseEnvironment({
        ...process.env,
        NODE_ENV: "production",
        AUTH_PHASE: "fastify",
        STORAGE_FORCE_PATH_STYLE: "false",
        WEB_ORIGINS: "http://app.example.test",
      }),
    ).toThrow("WEB_ORIGINS must use HTTPS");
  });

  it("requires an explicit authentication phase in production", () => {
    const productionInput: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: "production",
      WEB_ORIGINS: "https://app.example.test",
      DATABASE_URL: "postgresql://user:password@db.example.test:5432/bcoz",
      SESSION_SECRET: "a-production-session-secret-value",
      STORAGE_ENDPOINT: "https://storage.example.test",
      STORAGE_ACCESS_KEY_ID: "production-access",
      STORAGE_SECRET_ACCESS_KEY: "production-secret",
      STORAGE_FORCE_PATH_STYLE: "false",
      GOOGLE_CLIENT_ID: "production-client",
      GOOGLE_CLIENT_SECRET: "production-secret",
      GOOGLE_REDIRECT_URI: "https://api.example.test/auth/google/callback",
    };
    delete productionInput.AUTH_PHASE;

    expect(() => parseEnvironment(productionInput)).toThrow(
      "Production AUTH_PHASE must be explicitly configured.",
    );
  });

  it("rejects omitted production origins instead of inheriting localhost defaults", () => {
    const productionInput: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: "production",
      AUTH_PHASE: "fastify",
      DATABASE_URL: "postgresql://user:password@db.example.test:5432/bcoz",
      SESSION_SECRET: "a-production-session-secret-value",
      STORAGE_ENDPOINT: "https://storage.example.test",
      STORAGE_ACCESS_KEY_ID: "production-access",
      STORAGE_SECRET_ACCESS_KEY: "production-secret",
      STORAGE_FORCE_PATH_STYLE: "false",
      GOOGLE_CLIENT_ID: "production-client",
      GOOGLE_CLIENT_SECRET: "production-secret",
      GOOGLE_REDIRECT_URI: "https://api.example.test/auth/google/callback",
    };
    delete productionInput.WEB_ORIGINS;

    expect(() => parseEnvironment(productionInput)).toThrow(
      "Production WEB_ORIGINS must be explicitly configured.",
    );
  });

  it("accepts a complete explicit production environment", () => {
    const environment = parseEnvironment({
      ...process.env,
      NODE_ENV: "production",
      AUTH_PHASE: "fastify",
      WEB_ORIGINS: "https://app.example.test,https://staff.example.test/",
      DATABASE_URL: "postgresql://user:password@db.example.test:5432/bcoz",
      SESSION_SECRET: "a-production-session-secret-value",
      STORAGE_ENDPOINT: "https://storage.example.test",
      STORAGE_ACCESS_KEY_ID: "production-access",
      STORAGE_SECRET_ACCESS_KEY: "production-secret",
      STORAGE_FORCE_PATH_STYLE: "false",
      GOOGLE_CLIENT_ID: "production-client",
      GOOGLE_CLIENT_SECRET: "production-secret",
      GOOGLE_REDIRECT_URI: "https://api.example.test/auth/google/callback",
    });

    expect(environment.webOrigins).toEqual([
      "https://app.example.test",
      "https://staff.example.test",
    ]);
    expect(environment.storageForcePathStyle).toBe(false);
  });

  it("does not require Google provider settings during the Supabase phase", () => {
    const environment = parseEnvironment({
      ...process.env,
      NODE_ENV: "production",
      AUTH_PHASE: "supabase",
      WEB_ORIGINS: "https://app.example.test,https://staff.example.test/",
      DATABASE_URL: "postgresql://user:password@db.example.test:5432/bcoz",
      SESSION_SECRET: "a-production-session-secret-value",
      STORAGE_ENDPOINT: "https://storage.example.test",
      STORAGE_ACCESS_KEY_ID: "production-access",
      STORAGE_SECRET_ACCESS_KEY: "production-secret",
      STORAGE_FORCE_PATH_STYLE: "false",
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
      GOOGLE_REDIRECT_URI: "",
      SUPABASE_URL: "https://project.supabase.co",
    });

    expect(environment.authPhase).toBe("supabase");
    expect(environment.googleClientId).toBeUndefined();
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
