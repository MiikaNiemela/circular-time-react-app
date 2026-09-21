import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import SignIn from "./sign-in";

vi.mock("../data/providers/google/config", () => ({
  GOOGLE_CLIENT_ID: "test-google-id",
  googleRedirectUri: (origin: string) => `${origin}/auth/google/callback`,
  isGoogleConfigured: () => true,
}));

vi.mock("../data/providers/outlook/config", () => ({
  OUTLOOK_CLIENT_ID: "test-outlook-id",
  outlookRedirectUri: (origin: string) => `${origin}/auth/outlook/callback`,
  isOutlookConfigured: () => true,
}));

function HomeStub() {
  return <div data-testid="home">Home</div>;
}

const SignInStub = createRoutesStub([
  { path: "/sign-in", Component: SignIn },
  { path: "/", Component: HomeStub },
]);

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("SignIn route", () => {
  it("renders the app name and sign-in buttons when not authenticated", () => {
    render(<SignInStub initialEntries={["/sign-in"]} />);
    expect(screen.getByRole("heading", { name: "Circular Time" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign in with Google" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign in with Outlook" })).toBeTruthy();
  });

  it("redirects to / when Google tokens are already in localStorage", async () => {
    localStorage.setItem(
      "circular-time-google-tokens",
      JSON.stringify({ accessToken: "tok", expiresAt: Date.now() + 3_600_000 })
    );
    render(<SignInStub initialEntries={["/sign-in"]} />);
    await screen.findByTestId("home");
    expect(screen.queryByRole("heading", { name: "Circular Time" })).toBeNull();
  });

  it("redirects to / when Outlook tokens are already in localStorage", async () => {
    localStorage.setItem(
      "circular-time-outlook-tokens",
      JSON.stringify({ accessToken: "tok", expiresAt: Date.now() + 3_600_000 })
    );
    render(<SignInStub initialEntries={["/sign-in"]} />);
    await screen.findByTestId("home");
    expect(screen.queryByRole("heading", { name: "Circular Time" })).toBeNull();
  });
});
