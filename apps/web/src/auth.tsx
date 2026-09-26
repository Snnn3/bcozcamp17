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
  audience: "participant" | "staff";
  children: ReactNode;
}

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN ?? "http://localhost:3000";

export function RouteGuard({ audience, children }: RouteGuardProps): ReactElement {
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
      <SessionLoadingState audience={audience} message="Please wait while access is verified." />
    );
  }

  if (state.status === "unauthenticated") {
    return <LoginPage audience={audience} />;
  }

  if (state.status === "error") {
    return (
      <SessionErrorState
        audience={audience}
        description="Try again shortly. No application or review action was performed."
      />
    );
  }

  if (audience === "staff" && !canUseStaffWorkspace(state.session)) {
    return (
      <AccessDeniedState
        audience={audience}
        description="Your Google account is signed in, but it does not have the current Staff application-read permission."
      />
    );
  }

  return <>{children}</>;
}

function LoginPage({ audience }: Pick<RouteGuardProps, "audience">): ReactElement {
  return (
    <SignInPrompt
      audience={audience}
      title="Continue with Google to open this shell"
      description="BCOZ Camp uses a server-managed session. Your browser never stores a provider token or local password."
      loginUrl={createLoginUrl()}
    />
  );
}

function createLoginUrl(): string {
  const returnTo = `${window.location.origin}${window.location.pathname}${window.location.search}`;
  return createGoogleLoginUrl(API_ORIGIN, returnTo);
}
