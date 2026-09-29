import { generateKeyPairSync, sign } from "node:crypto";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import type { AuthenticatedPrincipal } from "@bcoz/auth";
import {
  InvalidSupabaseAccessTokenError,
  SupabaseAccessTokenVerifier,
  registerSupabaseIdentityRoute,
  resolveSupabaseBearerPrincipal,
  type SupabaseAuthIdentityDirectory,
} from "../../apps/server/src/supabaseAuth";
import type { UserDirectory } from "../../apps/server/src/auth";

const SUPABASE_USER_ID = "c39f9b10-2ec6-4d21-8bd4-f0aeb621bb0f";
const APPLICATION_USER_ID = "1c1920b9-cc95-4e32-9e63-fb46f00b1664";
const NOW = 1_700_000_000_000;
const ISSUER = "https://project.supabase.co/auth/v1";

const keyPair = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicJwk = {
  ...keyPair.publicKey.export({ format: "jwk" }),
  kid: "test-key",
  alg: "RS256",
  use: "sig",
};
const fetchJwks: typeof fetch = async () =>
  new Response(JSON.stringify({ keys: [publicJwk] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

function createToken(
  claims: Record<string, unknown> = {
    iss: ISSUER,
    aud: "authenticated",
    role: "authenticated",
    sub: SUPABASE_USER_ID,
    iat: NOW / 1_000,
    exp: NOW / 1_000 + 60,
    app_metadata: { user_id: "attacker", roles: ["admin"], permissions: ["permissions_manage"] },
    user_metadata: { app_user_id: "attacker", role: "admin" },
  },
  algorithm = "RS256",
  signingKey = keyPair.privateKey,
): string {
  const encodedHeader = Buffer.from(
    JSON.stringify({ alg: algorithm, kid: "test-key", typ: "JWT" }),
  ).toString("base64url");
  const encodedClaims = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signingInput = `${encodedHeader}.${encodedClaims}`;
  const signature = sign("RSA-SHA256", Buffer.from(signingInput), signingKey);
  return `${signingInput}.${signature.toString("base64url")}`;
}

describe("Supabase temporary bearer authentication", () => {
  it("verifies an asymmetric Supabase token and returns only its auth subject", async () => {
    const verifier = new SupabaseAccessTokenVerifier({
      supabaseUrl: "https://project.supabase.co",
      now: () => NOW,
      fetcher: fetchJwks,
    });

    await expect(verifier.verify(createToken())).resolves.toEqual({ subject: SUPABASE_USER_ID });
  });

  it.each([
    ["a mismatched issuer", { iss: "https://other.supabase.co/auth/v1" }],
    ["a mismatched audience", { aud: "service_role" }],
    ["a privileged service role", { role: "service_role" }],
    ["an expired token", { exp: NOW / 1_000 - 1 }],
    ["a non-UUID subject", { sub: "not-a-uuid" }],
  ])("rejects a token with %s", async (_description, claimOverride) => {
    const verifier = new SupabaseAccessTokenVerifier({
      supabaseUrl: "https://project.supabase.co",
      now: () => NOW,
      fetcher: fetchJwks,
    });
    const claims = {
      iss: ISSUER,
      aud: "authenticated",
      role: "authenticated",
      sub: SUPABASE_USER_ID,
      iat: NOW / 1_000,
      exp: NOW / 1_000 + 60,
      ...claimOverride,
    };

    await expect(verifier.verify(createToken(claims))).rejects.toBeInstanceOf(
      InvalidSupabaseAccessTokenError,
    );
  });

  it("rejects legacy HMAC tokens even if their claims look valid", async () => {
    const verifier = new SupabaseAccessTokenVerifier({
      supabaseUrl: "https://project.supabase.co",
      now: () => NOW,
      fetcher: fetchJwks,
    });

    await expect(verifier.verify(createToken(undefined, "HS256"))).rejects.toBeInstanceOf(
      InvalidSupabaseAccessTokenError,
    );
  });

  it("rejects a token with a signature from another key", async () => {
    const verifier = new SupabaseAccessTokenVerifier({
      supabaseUrl: "https://project.supabase.co",
      now: () => NOW,
      fetcher: fetchJwks,
    });
    const otherKeyPair = generateKeyPairSync("rsa", { modulusLength: 2048 });

    await expect(
      verifier.verify(createToken(undefined, "RS256", otherKeyPair.privateKey)),
    ).rejects.toBeInstanceOf(InvalidSupabaseAccessTokenError);
  });

  it("resolves the verified Supabase subject through the mapping and reloads local permissions", async () => {
    const principal: AuthenticatedPrincipal = {
      userId: APPLICATION_USER_ID,
      email: "participant@example.test",
      status: "active",
      roles: ["participant"],
      permissions: [],
    };
    const identityDirectory: SupabaseAuthIdentityDirectory = {
      resolveApplicationUserId: async (supabaseUserId) =>
        supabaseUserId === SUPABASE_USER_ID ? APPLICATION_USER_ID : null,
    };
    const userDirectory: UserDirectory = {
      resolveGoogleIdentity: async () => ({ kind: "email_collision" }),
      getPrincipal: async (userId) => (userId === APPLICATION_USER_ID ? principal : null),
    };

    const resolved = await resolveSupabaseBearerPrincipal(`Bearer ${createToken()}`, {
      tokenVerifier: new SupabaseAccessTokenVerifier({
        supabaseUrl: "https://project.supabase.co",
        now: () => NOW,
        fetcher: fetchJwks,
      }),
      identityDirectory,
      userDirectory,
    });

    expect(resolved).toEqual(principal);
  });

  it("does not authenticate a valid token without a trusted identity mapping", async () => {
    const identityDirectory: SupabaseAuthIdentityDirectory = {
      resolveApplicationUserId: async () => null,
    };
    const userDirectory: UserDirectory = {
      resolveGoogleIdentity: async () => ({ kind: "email_collision" }),
      getPrincipal: async () => null,
    };

    const resolved = await resolveSupabaseBearerPrincipal(`Bearer ${createToken()}`, {
      tokenVerifier: new SupabaseAccessTokenVerifier({
        supabaseUrl: "https://project.supabase.co",
        now: () => NOW,
        fetcher: fetchJwks,
      }),
      identityDirectory,
      userDirectory,
    });

    expect(resolved).toBeNull();
  });

  it("serves the mapped local identity without returning Supabase claims or token", async () => {
    const principal: AuthenticatedPrincipal = {
      userId: APPLICATION_USER_ID,
      email: "participant@example.test",
      status: "active",
      roles: ["participant"],
      permissions: [],
    };
    const server = Fastify();
    registerSupabaseIdentityRoute(server, {
      tokenVerifier: new SupabaseAccessTokenVerifier({
        supabaseUrl: "https://project.supabase.co",
        now: () => NOW,
        fetcher: fetchJwks,
      }),
      identityDirectory: {
        resolveApplicationUserId: async () => APPLICATION_USER_ID,
      },
      userDirectory: {
        resolveGoogleIdentity: async () => ({ kind: "email_collision" }),
        getPrincipal: async () => principal,
      },
    });

    const unauthorized = await server.inject({
      method: "GET",
      url: "/api/v1/auth/supabase/session",
    });
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/auth/supabase/session",
      headers: { authorization: `Bearer ${createToken()}` },
    });

    expect(unauthorized.statusCode).toBe(401);
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.json()).toMatchObject({
      data: {
        userId: APPLICATION_USER_ID,
        email: principal.email,
        roles: ["participant"],
      },
    });
    expect(response.body).not.toContain("supabaseUserId");
    expect(response.body).not.toContain("access_token");
    await server.close();
  });
});
