import type { RoleCode } from "@bcoz/validation";

export type PermissionEffect = "allow" | "deny";

export interface PermissionGrant {
  code: string;
  effect: PermissionEffect;
}

export interface AuthenticatedPrincipal {
  userId: string;
  email: string;
  roles: readonly RoleCode[];
  permissions: readonly PermissionGrant[];
}

export function hasPermission(principal: AuthenticatedPrincipal, permissionCode: string): boolean {
  const grant = principal.permissions.find((permission) => permission.code === permissionCode);
  return grant?.effect === "allow";
}

export function hasRole(principal: AuthenticatedPrincipal, roleCode: RoleCode): boolean {
  return principal.roles.includes(roleCode);
}
