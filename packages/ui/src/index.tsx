import type { ReactElement, ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { Navigation, type NavigationItem } from "./Navigation";

export { Navigation, type NavigationItem } from "./Navigation";

export type ApplicationAudience = "participant" | "staff";

interface AppShellProps {
  audience: ApplicationAudience;
  navItems?: NavigationItem[];
  children: ReactNode;
}

const audienceCopy: Record<ApplicationAudience, { label: string; description: string }> = {
  participant: {
    label: "Participant Web",
    description: "Registration and document status for camp participants.",
  },
  staff: {
    label: "Staff Web",
    description: "Application and document review workspace for authorized staff.",
  },
};

export function AppShell({ audience, navItems, children }: AppShellProps): ReactElement {
  const copy = audienceCopy[audience];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-indigo-600 p-2 text-white" aria-hidden="true">
              <ShieldCheck size={20} strokeWidth={2.25} />
            </div>
            <div>
              <p className="text-sm font-semibold text-indigo-700">BCOZ Camp 17</p>
              <p className="text-xs text-slate-500">{copy.label}</p>
            </div>
          </div>
          {navItems !== undefined && navItems.length > 0 ? (
            <Navigation items={navItems} ariaLabel={`${copy.label} navigation`} />
          ) : null}
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            Sprint 0 shell
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">{children}</main>
    </div>
  );
}

interface PageHeadingProps {
  eyebrow: string;
  title: string;
  description: string;
}

export function PageHeading({ eyebrow, title, description }: PageHeadingProps): ReactElement {
  return (
    <div className="max-w-3xl">
      <p className="text-sm font-semibold uppercase tracking-wide text-indigo-700">{eyebrow}</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
      <p className="mt-4 text-base leading-7 text-slate-600">{description}</p>
    </div>
  );
}

interface StatusBannerProps {
  title: string;
  message: string;
}

export function StatusBanner({ title, message }: StatusBannerProps): ReactElement {
  return (
    <section
      className="mt-8 rounded-2xl border border-indigo-100 bg-indigo-50 p-5"
      aria-live="polite"
    >
      <h2 className="font-semibold text-indigo-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-indigo-900">{message}</p>
    </section>
  );
}
