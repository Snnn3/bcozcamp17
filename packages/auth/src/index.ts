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
