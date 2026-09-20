/// <reference types="vite/client" />

import { useEffect, useState, type ReactElement, type ReactNode } from "react";
import { AppShell, PageHeading, StatusBanner } from "@bcoz/ui";
import type { RoleCode } from "@bcoz/validation";

interface SessionSnapshot {
  userId: string;
  email: string;
  roles: RoleCode[];
  permissions: string[];
  expiresAt: string;
}

type SessionState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "error" }
  | { status: "authenticated"; session: SessionSnapshot };

interface RouteGuardProps {
  children: ReactNode;
}

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN ?? "http://localhost:3000";

export function StaffRouteGuard({ children }: RouteGuardProps): ReactElement {
  const [state, setState] = useState<SessionState>({ status: "loading" });

  useEffect(() => {
    let mounted = true;
    void readSession().then((nextState) => {
      if (mounted) {
        setState(nextState);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <AppShell audience="staff">
        <StatusBanner
          title="Checking your session"
          message="Please wait while Staff access is verified."
        />
      </AppShell>
    );
  }

  if (state.status === "unauthenticated") {
    return <LoginPage />;
  }

  if (state.status === "error") {
    return (
      <AppShell audience="staff">
        <PageHeading
          eyebrow="Authentication unavailable"
          title="We could not verify your session"
          description="Try again shortly. No review action was performed."
        />
        <StatusBanner
          title="Please retry"
          message="The API session check failed before this page could load."
        />
      </AppShell>
    );
  }

  if (!canUseStaffWorkspace(state.session)) {
    return (
      <AppShell audience="staff">
        <PageHeading
          eyebrow="Access denied"
          title="This workspace is for authorized Staff"
          description="Your Google account is signed in, but it does not have the current Staff application-read permission."
        />
        <StatusBanner
          title="Ask an Admin to review your access"
          message="The server checks the live role and permission state on every protected request."
        />
      </AppShell>
    );
  }

  return <>{children}</>;
}

function LoginPage(): ReactElement {
  return (
    <AppShell audience="staff">
      <PageHeading
        eyebrow="Sign in required"
        title="Continue with Google to open Staff Web"
        description="Staff access uses a server-managed session and live permission checks."
      />
      <div className="mt-8">
        <a
          className="inline-flex rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
          href={createLoginUrl()}
        >
          Continue with Google
        </a>
      </div>
    </AppShell>
  );
}

async function readSession(): Promise<SessionState> {
  try {
    const response = await fetch(`${API_ORIGIN}/api/v1/auth/session`, {
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

function parseSessionPayload(payload: unknown): SessionSnapshot | null {
  if (!isRecord(payload) || !isRecord(payload.data)) {
    return null;
  }
  const data = payload.data;
  if (
    typeof data.userId !== "string" ||
    typeof data.email !== "string" ||
    typeof data.expiresAt !== "string" ||
    !Array.isArray(data.roles) ||
    !Array.isArray(data.permissions) ||
    !data.roles.every(
      (role): role is RoleCode => role === "participant" || role === "staff" || role === "admin",
    ) ||
    !data.permissions.every((permission): permission is string => typeof permission === "string")
  ) {
    return null;
  }
  return {
    userId: data.userId,
    email: data.email,
    roles: data.roles,
    permissions: data.permissions,
    expiresAt: data.expiresAt,
  };
}

function canUseStaffWorkspace(session: SessionSnapshot): boolean {
  return (
    (session.roles.includes("staff") || session.roles.includes("admin")) &&
    session.permissions.includes("application_read")
  );
}

function createLoginUrl(): string {
  const returnTo = `${window.location.origin}${window.location.pathname}${window.location.search}`;
  return `${API_ORIGIN}/auth/google/start?returnTo=${encodeURIComponent(returnTo)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
