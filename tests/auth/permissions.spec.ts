import { describe, expect, it } from "vitest";
import {
  effectivePermissionCodes,
  hasPermission,
  hasRole,
  type AuthenticatedPrincipal,
} from "@bcoz/auth";

const basePrincipal: AuthenticatedPrincipal = {
  userId: "user-1",
  email: "staff@example.test",
  status: "active",
  roles: ["staff"],
  permissions: [],
};

describe("effective permission policy", () => {
  it("lets an explicit deny override an allow regardless of grant order", () => {
    const allowThenDeny: AuthenticatedPrincipal = {
      ...basePrincipal,
      permissions: [
        { code: "document_read", effect: "allow" },
        { code: "document_read", effect: "deny" },
      ],
    };
    const denyThenAllow: AuthenticatedPrincipal = {
      ...basePrincipal,
      permissions: [
        { code: "document_read", effect: "deny" },
        { code: "document_read", effect: "allow" },
      ],
    };

    expect(hasPermission(allowThenDeny, "document_read")).toBe(false);
    expect(hasPermission(denyThenAllow, "document_read")).toBe(false);
  });

  it("denies every capability and role for a disabled principal", () => {
    const disabledPrincipal: AuthenticatedPrincipal = {
      ...basePrincipal,
      status: "disabled",
      permissions: [{ code: "document_read", effect: "allow" }],
    };

    expect(hasPermission(disabledPrincipal, "document_read")).toBe(false);
    expect(hasRole(disabledPrincipal, "staff")).toBe(false);
    expect(effectivePermissionCodes(disabledPrincipal)).toEqual([]);
  });
});
