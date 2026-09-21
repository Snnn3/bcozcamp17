/// <reference types="vite/client" />

import { useEffect, useState, type ReactElement, type ReactNode } from "react";
import {
  canUseStaffWorkspace,
  createGoogleLoginUrl,
  readAuthSession,
  type SessionState,
} from "@bcoz/auth";
import { AppShell, PageHeading, StatusBanner } from "@bcoz/ui";

interface RouteGuardProps {
  children: ReactNode;
}

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN ?? "http://localhost:3000";

export function StaffRouteGuard({ children }: RouteGuardProps): ReactElement {
  const [state, setState] = useState<SessionState>({ status: "loading" });

  useEffect(() => {
    let mounted = true;
    void readAuthSession(API_ORIGIN).then((nextState) => {
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

function createLoginUrl(): string {
  const returnTo = `${window.location.origin}${window.location.pathname}${window.location.search}`;
  return createGoogleLoginUrl(API_ORIGIN, returnTo);
}
