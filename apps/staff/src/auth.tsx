/// <reference types="vite/client" />

import { useEffect, useState, type ReactElement, type ReactNode } from "react";
import {
  canUseStaffWorkspace,
  createGoogleLoginUrl,
  readAuthSession,
  type SessionState,
} from "@bcoz/auth";
import { AccessDeniedState, SessionErrorState, SessionLoadingState, SignInPrompt } from "@bcoz/ui";

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
      <SessionLoadingState audience="staff" message="Please wait while Staff access is verified." />
    );
  }

  if (state.status === "unauthenticated") {
    return <LoginPage />;
  }

  if (state.status === "error") {
    return (
      <SessionErrorState
        audience="staff"
        description="Try again shortly. No review action was performed."
      />
    );
  }

  if (!canUseStaffWorkspace(state.session)) {
    return (
      <AccessDeniedState
        audience="staff"
        description="Your Google account is signed in, but it does not have the current Staff application-read permission."
      />
    );
  }

  return <>{children}</>;
}

function LoginPage(): ReactElement {
  return (
    <SignInPrompt
      audience="staff"
      title="Continue with Google to open Staff Web"
      description="Staff access uses a server-managed session and live permission checks."
      loginUrl={createLoginUrl()}
    />
  );
}

function createLoginUrl(): string {
  const returnTo = `${window.location.origin}${window.location.pathname}${window.location.search}`;
  return createGoogleLoginUrl(API_ORIGIN, returnTo);
}
