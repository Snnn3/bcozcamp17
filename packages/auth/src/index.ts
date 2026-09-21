import type { RoleCode } from "@bcoz/validation";

export type PermissionEffect = "allow" | "deny";
export type PrincipalStatus = "active" | "disabled";

export const permissionCodes = [
  "application_read",
  "document_read",
  "document_review",
  "internal_note_read",
  "internal_note_write",
  "application_final_decision",
  "export_applications",
  "configuration_manage",
  "permissions_manage",
] as const;

export type PermissionCode = (typeof permissionCodes)[number];

export interface PermissionGrant {
  code: string;
  effect: PermissionEffect;
}

export interface AuthenticatedPrincipal {
  userId: string;
  email: string;
  status: PrincipalStatus;
  roles: readonly RoleCode[];
  permissions: readonly PermissionGrant[];
}

export interface SessionSnapshot {
  userId: string;
  email: string;
  roles: RoleCode[];
  permissions: string[];
  expiresAt: string;
}

export type SessionState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "error" }
  | { status: "authenticated"; session: SessionSnapshot };

export async function readAuthSession(
  apiOrigin: string,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<Exclude<SessionState, { status: "loading" }>> {
  try {
    const response = await fetcher(`${apiOrigin}/api/v1/auth/session`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (response.status === 401) {
      return { status: "unauthenticated" };
    }
    if (!response.ok) {
      return { status: "error" };
    }

    const payload: unknown = await response.json();
    const session = parseSessionPayload(payload);
    return session === null ? { status: "error" } : { status: "authenticated", session };
  } catch {
    return { status: "error" };
  }
}

export function parseSessionPayload(payload: unknown): SessionSnapshot | null {
  if (!isRecord(payload) || !isRecord(payload.data)) {
    return null;
  }

  const data = payload.data;
  const roles = Array.isArray(data.roles) ? data.roles.filter(isRoleCode) : [];
  const permissions = Array.isArray(data.permissions)
    ? data.permissions.filter((permission): permission is string => typeof permission === "string")
    : [];
  if (
    typeof data.userId !== "string" ||
    typeof data.email !== "string" ||
    typeof data.expiresAt !== "string" ||
    !Array.isArray(data.roles) ||
    roles.length !== data.roles.length ||
    !Array.isArray(data.permissions) ||
    permissions.length !== data.permissions.length
  ) {
    return null;
  }

  return {
    userId: data.userId,
    email: data.email,
    roles,
    permissions,
    expiresAt: data.expiresAt,
  };
}

export function canUseStaffWorkspace(session: SessionSnapshot): boolean {
  return (
    (session.roles.includes("staff") || session.roles.includes("admin")) &&
    session.permissions.includes("application_read")
  );
}

export function createGoogleLoginUrl(apiOrigin: string, returnTo: string): string {
  const url = new URL("/auth/google/start", apiOrigin);
  url.searchParams.set("returnTo", returnTo);
  return url.toString();
}

export function hasPermission(principal: AuthenticatedPrincipal, permissionCode: string): boolean {
  if (principal.status === "disabled") {
    return false;
  }

  const grants = principal.permissions.filter((permission) => permission.code === permissionCode);
  return (
    grants.some((permission) => permission.effect === "allow") &&
    !grants.some((permission) => permission.effect === "deny")
  );
}

export function hasRole(principal: AuthenticatedPrincipal, roleCode: RoleCode): boolean {
  return principal.status !== "disabled" && principal.roles.includes(roleCode);
}

export function effectivePermissionCodes(principal: AuthenticatedPrincipal): string[] {
  if (principal.status === "disabled") {
    return [];
  }

  const codes = new Set(principal.permissions.map((permission) => permission.code));
  return [...codes].filter((code) => hasPermission(principal, code));
}

function isRoleCode(value: unknown): value is RoleCode {
  return value === "participant" || value === "staff" || value === "admin";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
