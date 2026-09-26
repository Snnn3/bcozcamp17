// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Navigation } from "@bcoz/ui";

const items = [
  { label: "Home", href: "/", current: true },
  { label: "Application status", href: "/status" },
];

describe("Navigation", () => {
  it("labels the nav landmark with the given ariaLabel", () => {
    render(<Navigation items={items} ariaLabel="Participant Web navigation" />);

    expect(
      screen.getByRole("navigation", { name: "Participant Web navigation" }),
    ).toBeInTheDocument();
  });

  it("marks the current page with aria-current", () => {
    render(<Navigation items={items} ariaLabel="Participant Web navigation" />);

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Application status" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("is keyboard-operable: Tab moves focus between links in order", async () => {
    const user = userEvent.setup();
    render(<Navigation items={items} ariaLabel="Participant Web navigation" />);

    const home = screen.getByRole("link", { name: "Home" });
    const status = screen.getByRole("link", { name: "Application status" });

    await user.tab();
    expect(home).toHaveFocus();

    await user.tab();
    expect(status).toHaveFocus();
  });
});
