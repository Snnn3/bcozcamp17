import { describe, expect, it } from "vitest";
import { buildServer } from "../../apps/server/src/app";
import { InMemorySessionStore } from "../../apps/server/src/auth";
import type { SupabaseBearerAuthenticationDependencies } from "../../apps/server/src/supabaseAuth";

const supabaseAuth: SupabaseBearerAuthenticationDependencies = {
  tokenVerifier: {
    verify: async () => ({ subject: "c39f9b10-2ec6-4d21-8bd4-f0aeb621bb0f" }),
  },
  identityDirectory: {
    resolveApplicationUserId: async () => null,
  },
  userDirectory: {
    resolveGoogleIdentity: async () => ({ kind: "email_collision" }),
    getPrincipal: async () => null,
  },
};

describe("server authentication phase", () => {
  it("does not expose Google routes during the Supabase bridge phase", async () => {
    const server = await buildServer({
      authPhase: "supabase",
      auth: { sessionStore: new InMemorySessionStore(), secureCookies: false },
      supabaseAuth,
    });

    expect(server.hasRoute({ method: "GET", url: "/auth/google/start" })).toBe(false);
    expect(server.hasRoute({ method: "GET", url: "/auth/google/callback" })).toBe(false);
    expect(server.hasRoute({ method: "GET", url: "/api/v1/auth/supabase/session" })).toBe(true);
    await server.close();
  });

  it("exposes Google routes during the final Fastify phase", async () => {
    const server = await buildServer({
      authPhase: "fastify",
      auth: { sessionStore: new InMemorySessionStore(), secureCookies: false },
    });

    expect(server.hasRoute({ method: "GET", url: "/auth/google/start" })).toBe(true);
    expect(server.hasRoute({ method: "GET", url: "/auth/google/callback" })).toBe(true);
    expect(server.hasRoute({ method: "GET", url: "/api/v1/auth/supabase/session" })).toBe(false);
    await server.close();
  });
});
