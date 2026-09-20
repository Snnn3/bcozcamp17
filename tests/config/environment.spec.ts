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
});
