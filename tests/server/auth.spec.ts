import { describe, expect, it } from "vitest";
import { buildServer } from "../../apps/server/src/app";
import {
  InMemoryUserDirectory,
  InMemorySessionStore,
  SESSION_COOKIE_NAME,
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
  const session = sessionStore.create(principal, 1_000);
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
});
