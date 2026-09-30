import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  completeGoogleAuth: vi.fn(),
  GoogleTokenStore: vi.fn(),
  persistCalendarTokens: vi.fn(),
  consumePostAuthRedirect: vi.fn(),
  navigate: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("../data/providers/google", () => ({
  completeGoogleAuth: mocks.completeGoogleAuth,
  GoogleTokenStore: mocks.GoogleTokenStore,
}));
vi.mock("../data/providers/google/config", () => ({
  GOOGLE_CLIENT_ID: "test-google-id",
  googleRedirectUri: (origin: string) => `${origin}/auth/google/callback`,
}));
vi.mock("../lib/authState", () => ({
  consumePostAuthRedirect: mocks.consumePostAuthRedirect,
}));
vi.mock("react-router", () => ({
  useNavigate: () => mocks.navigate,
  useSearchParams: () => [new URLSearchParams("code=authorization-code&state=oauth-state")],
}));

import GoogleCallback from "./auth.google.callback";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.completeGoogleAuth.mockResolvedValue({ accessToken: "identity-access-token" });
  mocks.GoogleTokenStore.mockImplementation(function GoogleTokenStoreMock() {
    return { set: mocks.persistCalendarTokens };
  });
  mocks.consumePostAuthRedirect.mockReturnValue({
    intent: "sign-in",
    returnTo: "/",
    provider: "google",
    oauthState: "oauth-state",
  });
  mocks.fetch.mockResolvedValue(
    new Response(JSON.stringify({ ok: true, calendarConnectionId: "google-connection-uuid" }), {
      status: 200,
    })
  );
  vi.stubGlobal("fetch", mocks.fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Google OAuth callback", () => {
  it("establishes an application session without persisting a calendar token for identity-only sign-in", async () => {
    render(<GoogleCallback />);

    await waitFor(() =>
      expect(mocks.completeGoogleAuth).toHaveBeenCalledWith(
        expect.objectContaining({ persistTokens: false })
      )
    );
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledOnce());
    expect(mocks.persistCalendarTokens).not.toHaveBeenCalled();

    const [url, request] = mocks.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/auth/session");
    expect(JSON.parse(String(request.body))).toEqual({
      intent: "sign-in",
      provider: "google",
      accessToken: "identity-access-token",
    });
    expect(mocks.navigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("fails closed instead of defaulting to a calendar connection when no OAuth flow is pending", async () => {
    mocks.consumePostAuthRedirect.mockReturnValue(null);
    const { findByText } = render(<GoogleCallback />);

    await findByText("OAuth flow state is missing. Start again from the sign-in or Settings page.");

    expect(mocks.completeGoogleAuth).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("fails closed when the pending OAuth state does not match the callback", async () => {
    mocks.consumePostAuthRedirect.mockReturnValue({
      intent: "sign-in",
      returnTo: "/",
      provider: "google",
      oauthState: "different-state",
    });
    const { findByText } = render(<GoogleCallback />);

    await findByText(
      "OAuth flow state does not match this callback. Start again from the sign-in or Settings page."
    );

    expect(mocks.completeGoogleAuth).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("posts a calendar connection to its authenticated endpoint after persisting calendar tokens", async () => {
    mocks.consumePostAuthRedirect.mockReturnValue({
      intent: "connect-calendar",
      returnTo: "/settings",
      provider: "google",
      oauthState: "oauth-state",
    });
    render(<GoogleCallback />);

    await waitFor(() =>
      expect(mocks.completeGoogleAuth).toHaveBeenCalledWith(
        expect.objectContaining({ persistTokens: false })
      )
    );
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(mocks.persistCalendarTokens).toHaveBeenCalledWith({
        accessToken: "identity-access-token",
        calendarConnectionId: "google-connection-uuid",
      })
    );

    const [url, request] = mocks.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/auth/calendar-connection");
    expect(JSON.parse(String(request.body))).toEqual({
      provider: "google",
      accessToken: "identity-access-token",
    });
    expect(mocks.navigate).toHaveBeenCalledWith("/settings", { replace: true });
  });
});
