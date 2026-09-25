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
import { StaffRouteGuard } from "./auth";
import "./styles.css";

const navItems = [
  { label: "Home", href: "/" },
  { label: "Applications", href: "/applications" },
];

function StaffLayout(): ReactElement {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <StaffRouteGuard>
      <AppShell
        audience="staff"
        navItems={navItems.map((item) => ({ ...item, current: item.href === pathname }))}
      >
        <Outlet />
      </AppShell>
    </StaffRouteGuard>
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

function StaffApplications(): ReactElement {
  return (
    <PageHeading
      eyebrow="Applications"
      title="Application review is not available yet"
      description="Once Sprint 2 delivers Staff review, this page will list applications with search, filtering, pagination, and per-document review actions."
    />
  );
}

const rootRoute = createRootRoute({ component: StaffLayout });
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: StaffHome,
});
const applicationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/applications",
  component: StaffApplications,
});
const routeTree = rootRoute.addChildren([indexRoute, applicationsRoute]);
const router = createRouter({ routeTree });

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("Staff Web root element is missing.");
}

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
