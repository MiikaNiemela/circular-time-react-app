import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import SignIn, * as signInRoute from "./sign-in";

const serverMocks = vi.hoisted(() => ({ getUserId: vi.fn() }));

vi.mock("../lib/session.server", () => ({ getUserId: serverMocks.getUserId }));

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

  it("redirects a request with an existing server session to the timeline", async () => {
    const loader = (signInRoute as { loader?: unknown }).loader;
    expect(loader).toBeTypeOf("function");
    if (typeof loader !== "function") return;

    serverMocks.getUserId.mockResolvedValue("user-uuid");
    await expect(
      loader({ request: new Request("http://localhost/sign-in") })
    ).rejects.toMatchObject({
      status: 302,
      headers: expect.any(Headers),
    });
  });

  it("does not treat Google calendar tokens in localStorage as an application session", async () => {
    localStorage.setItem(
      "circular-time-google-tokens",
      JSON.stringify({ accessToken: "tok", expiresAt: Date.now() + 3_600_000 })
    );
    render(<SignInStub initialEntries={["/sign-in"]} />);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Circular Time" })).toBeTruthy()
    );
    expect(screen.queryByTestId("home")).toBeNull();
  });

  it("does not treat Outlook calendar tokens in localStorage as an application session", async () => {
    localStorage.setItem(
      "circular-time-outlook-tokens",
      JSON.stringify({ accessToken: "tok", expiresAt: Date.now() + 3_600_000 })
    );
    render(<SignInStub initialEntries={["/sign-in"]} />);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Circular Time" })).toBeTruthy()
    );
    expect(screen.queryByTestId("home")).toBeNull();
  });
});
