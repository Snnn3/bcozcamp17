import { hasPermission, type AuthenticatedPrincipal } from "@bcoz/auth";

export function canReadPrivateDocument(
  principal: AuthenticatedPrincipal,
  ownerUserId: string,
): boolean {
  if (principal.status === "disabled" || ownerUserId.trim() === "") {
    return false;
  }
  if (hasExplicitDocumentReadDeny(principal)) {
    return false;
  }
  if (principal.userId === ownerUserId) {
    return true;
  }
  return hasPermission(principal, "application_read") && hasPermission(principal, "document_read");
}

export function assertCanReadPrivateDocument(
  principal: AuthenticatedPrincipal,
  ownerUserId: string,
): void {
  if (!canReadPrivateDocument(principal, ownerUserId)) {
    throw new Error("The current principal is not authorized to access this document.");
  }
}

function hasExplicitDocumentReadDeny(principal: AuthenticatedPrincipal): boolean {
  return principal.permissions.some(
    (permission) => permission.code === "document_read" && permission.effect === "deny",
  );
}
