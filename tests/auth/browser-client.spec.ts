import { describe, expect, it } from "vitest";
import {
  canUseStaffWorkspace,
  createGoogleLoginUrl,
  parseSessionPayload,
  readAuthSession,
} from "@bcoz/auth";

describe("shared browser authentication client", () => {
  it("parses the minimal session projection and staff policy", () => {
    const session = parseSessionPayload({
      data: {
        userId: "staff-1",
        email: "staff@example.test",
        roles: ["staff"],
        permissions: ["application_read"],
        expiresAt: "2026-09-21T10:00:00.000Z",
      },
    });

    expect(session).not.toBeNull();
    expect(canUseStaffWorkspace(session!)).toBe(true);
    expect(parseSessionPayload({ data: { userId: "missing-fields" } })).toBeNull();
  });

  it("maps session HTTP outcomes without duplicating app-specific parsing", async () => {
    const unauthenticated = await readAuthSession(
      "http://localhost:3000",
      async () => new Response(null, { status: 401 }),
    );
    const failure = await readAuthSession(
      "http://localhost:3000",
      async () => new Response(null, { status: 503 }),
    );
    const authenticated = await readAuthSession(
      "http://localhost:3000",
      async () =>
        new Response(
          JSON.stringify({
            data: {
              userId: "participant-1",
              email: "participant@example.test",
              roles: ["participant"],
              permissions: [],
              expiresAt: "2026-09-21T10:00:00.000Z",
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );

    expect(unauthenticated).toEqual({ status: "unauthenticated" });
    expect(failure).toEqual({ status: "error" });
    expect(authenticated).toMatchObject({
      status: "authenticated",
      session: { userId: "participant-1" },
    });
  });

  it("builds an allowlisted login URL with an encoded return destination", () => {
    const loginUrl = createGoogleLoginUrl(
      "http://localhost:3000",
      "http://localhost:5173/application?step=documents",
    );
    const parsed = new URL(loginUrl);

    expect(parsed.pathname).toBe("/auth/google/start");
    expect(parsed.searchParams.get("returnTo")).toBe(
      "http://localhost:5173/application?step=documents",
    );
  });
});
