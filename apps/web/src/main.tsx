import { StrictMode, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { AppShell, PageHeading, StatusBanner } from "@bcoz/ui";
import "./styles.css";

function ParticipantLayout(): ReactElement {
  return (
    <AppShell audience="participant">
      <Outlet />
    </AppShell>
  );
}

function ParticipantHome(): ReactElement {
  return (
    <>
      <PageHeading
        eyebrow="Participant Web"
        title="Your camp application, in one place"
        description="The registration and document-review flow will be added in Sprint 1. This responsive shell establishes the public participant boundary without connecting the browser directly to the database."
      />
      <StatusBanner
        title="Sprint 0 foundation is ready"
        message="Google sign-in, application forms, private uploads, and applicant status projections will be delivered through the API in the next sprint."
      />
    </>
  );
}

const rootRoute = createRootRoute({ component: ParticipantLayout });
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: ParticipantHome,
});
const routeTree = rootRoute.addChildren([indexRoute]);
const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("Participant Web root element is missing.");
}

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
