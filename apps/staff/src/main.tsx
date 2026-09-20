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

function StaffLayout(): ReactElement {
  return (
    <AppShell audience="staff">
      <Outlet />
    </AppShell>
  );
}

function StaffHome(): ReactElement {
  return (
    <>
      <PageHeading
        eyebrow="Staff Web"
        title="Review applications with clear boundaries"
        description="The Staff Web shell is separate from Participant Web and will use permission-aware API projections for application and document review in Sprint 2."
      />
      <StatusBanner
        title="Authorized workspace shell"
        message="Authentication, effective permissions, ownership checks, pagination, document review, and internal notes remain server-enforced."
      />
    </>
  );
}

const rootRoute = createRootRoute({ component: StaffLayout });
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: StaffHome,
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
  throw new Error("Staff Web root element is missing.");
}

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
