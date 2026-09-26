// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AccessDeniedState, SessionErrorState, SessionLoadingState, SignInPrompt } from "@bcoz/ui";

describe("SessionLoadingState", () => {
  it("renders the given loading message", () => {
    render(<SessionLoadingState audience="participant" message="Please wait." />);

    expect(screen.getByText("Checking your session")).toBeInTheDocument();
    expect(screen.getByText("Please wait.")).toBeInTheDocument();
  });
});

describe("SessionErrorState", () => {
  it("renders the given description and a retry prompt", () => {
    render(<SessionErrorState audience="staff" description="Try again shortly." />);

    expect(screen.getByText("We could not verify your session")).toBeInTheDocument();
    expect(screen.getByText("Try again shortly.")).toBeInTheDocument();
    expect(screen.getByText("Please retry")).toBeInTheDocument();
  });
});

describe("AccessDeniedState", () => {
  it("renders the given denial description", () => {
    render(<AccessDeniedState audience="staff" description="No Staff permission." />);

    expect(screen.getByText("No Staff permission.")).toBeInTheDocument();
  });
});

describe("SignInPrompt", () => {
  it("renders an accessible, focusable Google sign-in link", () => {
    render(
      <SignInPrompt
        audience="participant"
        title="Continue with Google"
        description="Sign in to continue."
        loginUrl="https://example.com/auth/google/start"
      />,
    );

    const link = screen.getByRole("link", { name: "Continue with Google" });
    expect(link).toHaveAttribute("href", "https://example.com/auth/google/start");
  });
});
