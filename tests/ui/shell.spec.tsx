// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppShell } from "@bcoz/ui";

describe("AppShell", () => {
  it("shows the Participant Web label for the participant audience", () => {
    render(
      <AppShell audience="participant">
        <p>page content</p>
      </AppShell>,
    );

    expect(screen.getByText("Participant Web")).toBeInTheDocument();
    expect(screen.getByText("page content")).toBeInTheDocument();
  });

  it("shows the Staff Web label for the staff audience", () => {
    render(
      <AppShell audience="staff">
        <p>page content</p>
      </AppShell>,
    );

    expect(screen.getByText("Staff Web")).toBeInTheDocument();
  });

  it("does not render a navigation landmark when navItems is omitted", () => {
    render(
      <AppShell audience="participant">
        <p>page content</p>
      </AppShell>,
    );

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("renders a navigation landmark when navItems is provided", () => {
    render(
      <AppShell audience="participant" navItems={[{ label: "Home", href: "/", current: true }]}>
        <p>page content</p>
      </AppShell>,
    );

    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
  });
});
