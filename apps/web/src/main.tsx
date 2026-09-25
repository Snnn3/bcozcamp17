import { StrictMode, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  useRouterState,
  RouterProvider,
} from "@tanstack/react-router";
import { AppShell, PageHeading, StatusBanner } from "@bcoz/ui";
import { RouteGuard } from "./auth";
import "./styles.css";

const navItems = [
  { label: "Home", href: "/" },
  { label: "Application status", href: "/status" },
];

function ParticipantLayout(): ReactElement {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <RouteGuard audience="participant">
      <AppShell
        audience="participant"
        navItems={navItems.map((item) => ({ ...item, current: item.href === pathname }))}
      >
        <Outlet />
      </AppShell>
    </RouteGuard>
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

function ParticipantStatus(): ReactElement {
  return (
    <PageHeading
      eyebrow="Application status"
      title="Status tracking is not available yet"
      description="Once Sprint 1 delivers registration, this page will show your application code, submitted documents, and any corrections a Staff reviewer has requested."
    />
  );
}

const rootRoute = createRootRoute({ component: ParticipantLayout });
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: ParticipantHome,
});
const statusRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/status",
  component: ParticipantStatus,
});
const routeTree = rootRoute.addChildren([indexRoute, statusRoute]);
const router = createRouter({ routeTree });

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("Participant Web root element is missing.");
}

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
