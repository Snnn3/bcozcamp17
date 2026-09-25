# Shared UI package

Responsive, accessible presentation primitives are shared by Participant Web
and Staff Web. Feature-specific behavior belongs in the owning application.

## Components

| Component | File | Purpose |
|---|---|---|
| `AppShell` | `src/Shell.tsx` | Page layout: header (logo, audience label, optional `Navigation`) plus a main content area. Every page renders inside this. |
| `PageHeading` | `src/Shell.tsx` | Eyebrow + title + description block used at the top of a page. |
| `StatusBanner` | `src/Shell.tsx` | Neutral/info callout (indigo) for short status messages. |
| `Navigation` | `src/Navigation.tsx` | Accessible `<nav>` with labeled links and `aria-current="page"` on the active item. Pass `navItems` to `AppShell` to render it. |
| `SessionLoadingState` | `src/AuthStates.tsx` | Full-page "checking your session" state, shown while `RouteGuard`/`StaffRouteGuard` resolve the auth session. |
| `SessionErrorState` | `src/AuthStates.tsx` | Full-page state for when the session check itself failed (not an access decision). |
| `AccessDeniedState` | `src/AuthStates.tsx` | Full-page state for an authenticated user who lacks the required permission. |
| `SignInPrompt` | `src/AuthStates.tsx` | Full-page "Continue with Google" sign-in screen. |
| `EmptyState` | `src/ConventionStates.tsx` | Generic "no data yet" block for feature screens (e.g. an empty list) — not tied to auth. |
| `ErrorState` | `src/ConventionStates.tsx` | Generic inline error block (`role="alert"`) for feature screens — not tied to auth. |

`AppShell`/`PageHeading`/`StatusBanner` live together in `Shell.tsx` so
`AuthStates.tsx` can import them without creating a circular dependency
through `index.tsx`, which only re-exports the public API.

Sprint 1/2 feature work should reuse `EmptyState`/`ErrorState` instead of
building new loading/error/empty layouts from scratch.
