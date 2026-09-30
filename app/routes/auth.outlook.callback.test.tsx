import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  completeOutlookAuth: vi.fn(),
  OutlookTokenStore: vi.fn(),
  persistCalendarTokens: vi.fn(),
  consumePostAuthRedirect: vi.fn(),
  navigate: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("../data/providers/outlook", () => ({
  completeOutlookAuth: mocks.completeOutlookAuth,
  OutlookTokenStore: mocks.OutlookTokenStore,
}));
vi.mock("../data/providers/outlook/config", () => ({
  OUTLOOK_CLIENT_ID: "test-outlook-id",
  outlookRedirectUri: (origin: string) => `${origin}/auth/outlook/callback`,
}));
vi.mock("../lib/authState", () => ({
  consumePostAuthRedirect: mocks.consumePostAuthRedirect,
}));
vi.mock("react-router", () => ({
  useNavigate: () => mocks.navigate,
  useSearchParams: () => [new URLSearchParams("code=authorization-code&state=oauth-state")],
}));

import OutlookCallback from "./auth.outlook.callback";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.completeOutlookAuth.mockResolvedValue({ accessToken: "identity-access-token" });
  mocks.OutlookTokenStore.mockImplementation(function OutlookTokenStoreMock() {
    return { set: mocks.persistCalendarTokens };
  });
  mocks.consumePostAuthRedirect.mockReturnValue({
    intent: "sign-in",
    returnTo: "/",
    provider: "outlook",
    oauthState: "oauth-state",
  });
  mocks.fetch.mockResolvedValue(
    new Response(JSON.stringify({ ok: true, calendarConnectionId: "outlook-connection-uuid" }), {
      status: 200,
    })
  );
  vi.stubGlobal("fetch", mocks.fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Outlook OAuth callback", () => {
  it("establishes an application session without persisting a calendar token for identity-only sign-in", async () => {
    render(<OutlookCallback />);

    await waitFor(() =>
      expect(mocks.completeOutlookAuth).toHaveBeenCalledWith(
        expect.objectContaining({ persistTokens: false })
      )
    );
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledOnce());
    expect(mocks.persistCalendarTokens).not.toHaveBeenCalled();

    const [url, request] = mocks.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/auth/session");
    expect(JSON.parse(String(request.body))).toEqual({
      intent: "sign-in",
      provider: "outlook",
      accessToken: "identity-access-token",
    });
    expect(mocks.navigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("fails closed instead of defaulting to a calendar connection when no OAuth flow is pending", async () => {
    mocks.consumePostAuthRedirect.mockReturnValue(null);
    const { findByText } = render(<OutlookCallback />);

    await findByText("OAuth flow state is missing. Start again from the sign-in or Settings page.");

    expect(mocks.completeOutlookAuth).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("fails closed when the pending OAuth provider does not match the callback", async () => {
    mocks.consumePostAuthRedirect.mockReturnValue({
      intent: "sign-in",
      returnTo: "/",
      provider: "google",
      oauthState: "oauth-state",
    });
    const { findByText } = render(<OutlookCallback />);

    await findByText(
      "OAuth flow state does not match this callback. Start again from the sign-in or Settings page."
    );

    expect(mocks.completeOutlookAuth).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("posts a calendar connection to its authenticated endpoint after persisting calendar tokens", async () => {
    mocks.consumePostAuthRedirect.mockReturnValue({
      intent: "connect-calendar",
      returnTo: "/settings",
      provider: "outlook",
      oauthState: "oauth-state",
    });
    render(<OutlookCallback />);

    await waitFor(() =>
      expect(mocks.completeOutlookAuth).toHaveBeenCalledWith(
        expect.objectContaining({ persistTokens: false })
      )
    );
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(mocks.persistCalendarTokens).toHaveBeenCalledWith({
        accessToken: "identity-access-token",
        calendarConnectionId: "outlook-connection-uuid",
      })
    );

    const [url, request] = mocks.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/auth/calendar-connection");
    expect(JSON.parse(String(request.body))).toEqual({
      provider: "outlook",
      accessToken: "identity-access-token",
    });
    expect(mocks.navigate).toHaveBeenCalledWith("/settings", { replace: true });
  });

  it("links an identity through its authenticated endpoint without storing calendar tokens", async () => {
    mocks.consumePostAuthRedirect.mockReturnValue({
      intent: "link-identity",
      returnTo: "/settings",
      provider: "outlook",
      oauthState: "oauth-state",
    });
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    render(<OutlookCallback />);

    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith("/settings", { replace: true })
    );
    const [url, request] = mocks.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/auth/identity-link");
    expect(JSON.parse(String(request.body))).toEqual({
      provider: "outlook",
      accessToken: "identity-access-token",
    });
    expect(mocks.persistCalendarTokens).not.toHaveBeenCalled();
  });

  it("shows the server's reason when an identity cannot be linked", async () => {
    mocks.consumePostAuthRedirect.mockReturnValue({
      intent: "link-identity",
      returnTo: "/settings",
      provider: "outlook",
      oauthState: "oauth-state",
    });
    mocks.fetch.mockResolvedValue(
      new Response(JSON.stringify({ error: "Accounts are never merged." }), { status: 409 })
    );
    const { findByText } = render(<OutlookCallback />);

    await findByText("Accounts are never merged.");
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});
