import type { ReactElement } from "react";
import { Inbox, TriangleAlert } from "lucide-react";

interface EmptyStateProps {
  title: string;
  message: string;
}

export function EmptyState({ title, message }: EmptyStateProps): ReactElement {
  return (
    <section className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <div
        className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500"
        aria-hidden="true"
      >
        <Inbox size={20} strokeWidth={2} />
      </div>
      <h2 className="mt-4 font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
    </section>
  );
}

interface ErrorStateProps {
  title: string;
  message: string;
}

export function ErrorState({ title, message }: ErrorStateProps): ReactElement {
  return (
    <section className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5" role="alert">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-red-600" aria-hidden="true">
          <TriangleAlert size={20} strokeWidth={2.25} />
        </div>
        <div>
          <h2 className="font-semibold text-red-950">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-red-900">{message}</p>
        </div>
      </div>
    </section>
  );
}
