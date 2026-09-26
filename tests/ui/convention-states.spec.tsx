// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState, ErrorState } from "@bcoz/ui";

describe("EmptyState", () => {
  it("renders the given title and message", () => {
    render(
      <EmptyState title="No applications yet" message="Check back after Sprint 1 launches." />,
    );

    expect(screen.getByText("No applications yet")).toBeInTheDocument();
    expect(screen.getByText("Check back after Sprint 1 launches.")).toBeInTheDocument();
  });
});

describe("ErrorState", () => {
  it("renders as an alert with the given title and message", () => {
    render(<ErrorState title="Could not load applications" message="Try again shortly." />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Could not load applications");
    expect(alert).toHaveTextContent("Try again shortly.");
  });
});
