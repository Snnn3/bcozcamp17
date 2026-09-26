import type { ReactElement } from "react";
import { AppShell, PageHeading, StatusBanner, type ApplicationAudience } from "./Shell";

interface AudienceProps {
  audience: ApplicationAudience;
}

interface SessionLoadingStateProps extends AudienceProps {
  message: string;
}

export function SessionLoadingState({ audience, message }: SessionLoadingStateProps): ReactElement {
  return (
    <AppShell audience={audience}>
      <StatusBanner title="Checking your session" message={message} />
    </AppShell>
  );
}

interface SessionErrorStateProps extends AudienceProps {
  description: string;
}

export function SessionErrorState({ audience, description }: SessionErrorStateProps): ReactElement {
  return (
    <AppShell audience={audience}>
      <PageHeading
        eyebrow="Authentication unavailable"
        title="We could not verify your session"
        description={description}
      />
      <StatusBanner
        title="Please retry"
        message="The API session check failed before this page could load."
      />
    </AppShell>
  );
}

interface AccessDeniedStateProps extends AudienceProps {
  description: string;
}

export function AccessDeniedState({ audience, description }: AccessDeniedStateProps): ReactElement {
  return (
    <AppShell audience={audience}>
      <PageHeading
        eyebrow="Access denied"
        title="This workspace is for authorized Staff"
        description={description}
      />
      <StatusBanner
        title="Ask an Admin to review your access"
        message="The server checks the live role and permission state on every protected request."
      />
    </AppShell>
  );
}

interface SignInPromptProps extends AudienceProps {
  title: string;
  description: string;
  loginUrl: string;
}

export function SignInPrompt({
  audience,
  title,
  description,
  loginUrl,
}: SignInPromptProps): ReactElement {
  return (
    <AppShell audience={audience}>
      <PageHeading eyebrow="Sign in required" title={title} description={description} />
      <div className="mt-8">
        <a
          className="inline-flex rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
          href={loginUrl}
        >
          Continue with Google
        </a>
      </div>
    </AppShell>
  );
}
