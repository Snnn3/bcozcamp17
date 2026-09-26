import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { buildServer } from "../../apps/server/src/app";
import {
  createAuthBoundaryDependencies,
  registerAuthRoutes,
  InMemoryUserDirectory,
  InMemorySessionStore,
  OAUTH_BROWSER_BINDING_COOKIE_NAME,
  OAUTH_TRANSACTION_TIMEOUT_MS,
  SESSION_COOKIE_NAME,
  type LoginRateLimiter,
  type SessionStore,
  type GoogleIdentityProvider,
  type SessionRecord,
} from "../../apps/server/src/auth";
import type { AuthenticatedPrincipal } from "@bcoz/auth";

const staffPrincipal: AuthenticatedPrincipal = {
  userId: "staff-1",
  email: "staff@example.test",
  status: "active",
  roles: ["staff"],
  permissions: [{ code: "application_read", effect: "allow" }],
};

async function createTestServer(principal: AuthenticatedPrincipal): Promise<{
  server: Awaited<ReturnType<typeof buildServer>>;
  session: SessionRecord;
}> {
  const sessionStore = new InMemorySessionStore();
  const session = await sessionStore.create(principal, 1_000);
  const server = await buildServer({
    auth: {
      sessionStore,
      now: () => 1_000,
      secureCookies: false,
    },
  });
  return { server, session };
}

describe("server authentication boundary", () => {
  it("preserves email uniqueness when a returning Google identity changes email", async () => {
    const directory = new InMemoryUserDirectory();
    const firstIdentity = {
      subject: "subject-a",
      email: "first@example.test",
      emailVerified: true,
    } as const;

    await directory.resolveGoogleIdentity(firstIdentity);
    const updated = await directory.resolveGoogleIdentity({
      ...firstIdentity,
      email: "updated@example.test",
    });
    const collision = await directory.resolveGoogleIdentity({
      subject: "subject-b",
      email: "updated@example.test",
      emailVerified: true,
    });

    expect(updated).toMatchObject({
      kind: "authenticated",
      principal: { email: "updated@example.test" },
    });
    expect(collision).toEqual({ kind: "email_collision" });
  });

  it("rejects private session and Staff routes without a cookie", async () => {
    const server = await buildServer();

    const sessionResponse = await server.inject({ method: "GET", url: "/api/v1/auth/session" });
    const staffResponse = await server.inject({ method: "GET", url: "/api/v1/staff/access" });

    expect(sessionResponse.statusCode).toBe(401);
    expect(staffResponse.statusCode).toBe(401);
    await server.close();
  });

  it("returns a minimal session and permits a Staff principal with live permission", async () => {
    const { server, session } = await createTestServer(staffPrincipal);
    const cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(session.sessionId)}`;

    const sessionResponse = await server.inject({
      method: "GET",
      url: "/api/v1/auth/session",
      headers: { cookie },
    });
    const staffResponse = await server.inject({
      method: "GET",
      url: "/api/v1/staff/access",
      headers: { cookie },
    });

    expect(sessionResponse.statusCode).toBe(200);
    expect(sessionResponse.json()).toMatchObject({
      data: {
        userId: "staff-1",
        email: "staff@example.test",
        roles: ["staff"],
        permissions: ["application_read"],
      },
    });
    expect(staffResponse.statusCode).toBe(200);
    expect(sessionResponse.headers["cache-control"]).toBe("no-store");
    expect(staffResponse.headers["cache-control"]).toBe("no-store");
    await server.close();
  });

  it("marks every private access success as non-cacheable", async () => {
    const adminPrincipal: AuthenticatedPrincipal = {
      userId: "admin-1",
      email: "admin@example.test",
      status: "active",
      roles: ["admin"],
      permissions: [
        { code: "application_read", effect: "allow" },
        { code: "permissions_manage", effect: "allow" },
      ],
    };
    const { server, session } = await createTestServer(adminPrincipal);
    const cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(session.sessionId)}`;

    for (const url of ["/api/v1/me/access", "/api/v1/staff/access", "/api/v1/admin/access"]) {
      const response = await server.inject({ method: "GET", url, headers: { cookie } });
      expect(response.statusCode).toBe(200);
      expect(response.headers["cache-control"]).toBe("no-store");
    }
    await server.close();
  });

  it("includes a safe request ID in authentication errors", async () => {
    const server = await buildServer();
    const response = await server.inject({ method: "GET", url: "/api/v1/me/access" });

    expect(response.statusCode).toBe(401);
    const errorBody = response.json() as { error?: { code?: string; requestId?: string } };
    expect(errorBody.error?.code).toBe("AUTHENTICATION_REQUIRED");
    expect(errorBody.error?.requestId).toEqual(expect.any(String));
    expect(response.headers["cache-control"]).toBe("no-store");
    await server.close();
  });

  it("maps dependency failures to a safe retryable error envelope", async () => {
    const failingSessionStore: SessionStore = {
      create: async () => {
        throw new Error("Prisma SQL details must not escape");
      },
      get: async () => {
        throw new Error("Prisma SQL details must not escape");
      },
      rotate: async () => null,
      revoke: async () => undefined,
    };
    const server = await buildServer({
      auth: { sessionStore: failingSessionStore, secureCookies: false },
    });

    const response = await server.inject({
      method: "GET",
      url: "/api/v1/auth/session",
      headers: { cookie: `${SESSION_COOKIE_NAME}=session-id` },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      error: {
        code: "DEPENDENCY_UNAVAILABLE",
        message: "A required service is temporarily unavailable.",
        requestId: expect.any(String),
      },
    });
    expect(response.body).not.toContain("Prisma");
    await server.close();
  });

  it("denies a disabled principal even when its session has a prior allow", async () => {
    const { server, session } = await createTestServer({ ...staffPrincipal, status: "disabled" });
    const cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(session.sessionId)}`;

    const response = await server.inject({
      method: "GET",
      url: "/api/v1/auth/session",
      headers: { cookie },
    });

    expect(response.statusCode).toBe(401);
    await server.close();
  });

  it("rejects production defaults that use volatile authentication state", () => {
    expect(() => createAuthBoundaryDependencies({ production: true })).toThrow(
      "Production authentication requires durable database adapters.",
    );
  });

  it("requires the session CSRF token before revoking logout state", async () => {
    const { server, session } = await createTestServer(staffPrincipal);
    const cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(session.sessionId)}`;

    const rejectedResponse = await server.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: { cookie },
    });
    const acceptedResponse = await server.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: { cookie, "x-csrf-token": session.csrfToken },
    });
    const sessionResponse = await server.inject({
      method: "GET",
      url: "/api/v1/auth/session",
      headers: { cookie },
    });

    expect(rejectedResponse.statusCode).toBe(403);
    expect(acceptedResponse.statusCode).toBe(204);
    expect(sessionResponse.statusCode).toBe(401);
    await server.close();
  });

  it("binds OAuth transactions to the initiating browser and consumes them once", async () => {
    let now = 1_000;
    const provider: GoogleIdentityProvider = {
      createAuthorizationUrl: ({ state }) => `https://accounts.google.test/?state=${state}`,
      exchangeAuthorizationCode: async () => ({
        subject: "oauth-subject",
        email: "oauth@example.test",
        emailVerified: true,
      }),
    };
    const server = Fastify();
    registerAuthRoutes(
      server,
      createAuthBoundaryDependencies({ googleProvider: provider, now: () => now }),
      {
        allowedOrigins: ["http://localhost:5173"],
        googleClientId: "client-id",
        googleRedirectUri: "http://localhost:3000/auth/google/callback",
      },
    );

    const start = await server.inject({
      method: "GET",
      url: "/auth/google/start?returnTo=http%3A%2F%2Flocalhost%3A5173%2Fhome",
    });
    const location = new URL(start.headers.location ?? "");
    const state = location.searchParams.get("state");
    const bindingCookie = findSetCookieHeader(
      start.headers["set-cookie"],
      OAUTH_BROWSER_BINDING_COOKIE_NAME,
    );
    expect(state).not.toBeNull();
    expect(bindingCookie).toBeDefined();

    const cookie = bindingCookie?.split(";", 1)[0];
    const secondStart = await server.inject({
      method: "GET",
      url: "/auth/google/start?returnTo=http%3A%2F%2Flocalhost%3A5173%2Fsecond-tab",
      headers: { cookie },
    });
    const secondState = new URL(secondStart.headers.location ?? "").searchParams.get("state");
    expect(secondState).not.toBeNull();
    expect(
      findSetCookieHeader(secondStart.headers["set-cookie"], OAUTH_BROWSER_BINDING_COOKIE_NAME),
    ).toBeUndefined();

    const cancelledStart = await server.inject({
      method: "GET",
      url: "/auth/google/start?returnTo=http%3A%2F%2Flocalhost%3A5173%2Flogin%3Fauth%3Dold",
      headers: { cookie },
    });
    const cancelledState = new URL(cancelledStart.headers.location ?? "").searchParams.get("state");
    const cancelled = await server.inject({
      method: "GET",
      url: `/auth/google/callback?state=${cancelledState}&error=access_denied&error_description=secret-provider-detail`,
      headers: { cookie },
    });
    const cancelledLocation = new URL(cancelled.headers.location ?? "");
    expect(cancelled.statusCode).toBe(302);
    expect(cancelledLocation.origin).toBe("http://localhost:5173");
    expect(cancelledLocation.searchParams.get("auth")).toBe("cancelled");
    expect(cancelledLocation.searchParams.get("requestId")).toEqual(expect.any(String));
    expect(cancelledLocation.search).not.toContain("secret-provider-detail");
    expect(cancelledLocation.searchParams.get("auth")).not.toBe("old");

    const wrongBrowser = await server.inject({
      method: "GET",
      url: `/auth/google/callback?state=${state}&code=code`,
      headers: { cookie: `${OAUTH_BROWSER_BINDING_COOKIE_NAME}=wrong-browser` },
    });
    expect(wrongBrowser.statusCode).toBe(400);

    const callback = await server.inject({
      method: "GET",
      url: `/auth/google/callback?state=${state}&code=code`,
      headers: { cookie },
    });
    expect(callback.statusCode).toBe(302);

    const secondCallback = await server.inject({
      method: "GET",
      url: `/auth/google/callback?state=${secondState}&code=code`,
      headers: { cookie },
    });
    expect(secondCallback.statusCode).toBe(302);

    const reused = await server.inject({
      method: "GET",
      url: `/auth/google/callback?state=${state}&code=code`,
      headers: { cookie },
    });
    expect(reused.statusCode).toBe(400);

    const expiredStart = await server.inject({ method: "GET", url: "/auth/google/start" });
    const expiredLocation = new URL(expiredStart.headers.location ?? "");
    const expiredState = expiredLocation.searchParams.get("state");
    now += OAUTH_TRANSACTION_TIMEOUT_MS + 1;
    const expiredCookie = findSetCookieHeader(
      expiredStart.headers["set-cookie"],
      OAUTH_BROWSER_BINDING_COOKIE_NAME,
    );
    const expired = await server.inject({
      method: "GET",
      url: `/auth/google/callback?state=${expiredState}&code=code`,
      headers: { cookie: expiredCookie },
    });
    expect(expired.statusCode).toBe(400);

    await server.close();
  });

  it("returns 429 and Retry-After when login initiation exceeds its limiter", async () => {
    let calls = 0;
    const limiter: LoginRateLimiter = {
      consume: async () => {
        calls += 1;
        return { allowed: calls === 1, retryAfterSeconds: 7 };
      },
    };
    const provider: GoogleIdentityProvider = {
      createAuthorizationUrl: ({ state }) => `https://accounts.google.test/?state=${state}`,
      exchangeAuthorizationCode: async () => ({
        subject: "rate-limit-subject",
        email: "rate-limit@example.test",
        emailVerified: true,
      }),
    };
    const server = Fastify();
    registerAuthRoutes(
      server,
      createAuthBoundaryDependencies({ googleProvider: provider, loginRateLimiter: limiter }),
      {
        allowedOrigins: ["http://localhost:5173"],
        googleClientId: "client-id",
        googleRedirectUri: "http://localhost:3000/auth/google/callback",
      },
    );

    const first = await server.inject({ method: "GET", url: "/auth/google/start" });
    const second = await server.inject({ method: "GET", url: "/auth/google/start" });

    expect(first.statusCode).toBe(302);
    expect(second.statusCode).toBe(429);
    expect(second.headers["retry-after"]).toBe("7");
    expect(second.json()).toMatchObject({
      error: { code: "RATE_LIMITED", requestId: expect.any(String) },
    });
    await server.close();
  });
});

function findSetCookieHeader(
  value: string | string[] | undefined,
  cookieName: string,
): string | undefined {
  const headers = value === undefined ? [] : Array.isArray(value) ? value : [value];
  return headers.find((header) => header.startsWith(`${cookieName}=`))?.split(";", 1)[0];
}
