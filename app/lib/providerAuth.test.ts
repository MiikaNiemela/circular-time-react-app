import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  startGoogleCalendarConnection,
  startGoogleIdentityLink,
  startGoogleSignIn,
  startOutlookCalendarConnection,
  startOutlookIdentityLink,
  startOutlookSignIn,
} from "./providerAuth";

const mocks = vi.hoisted(() => ({
  isGoogleConfigured: vi.fn(() => true),
  startGoogleAuth: vi.fn(),
  isOutlookConfigured: vi.fn(() => true),
  startOutlookAuth: vi.fn(),
  setPostAuthRedirect: vi.fn(),
}));

vi.mock("../data/providers/google/config", () => ({
  GOOGLE_CLIENT_ID: "test-google-id",
  googleRedirectUri: (origin: string) => `${origin}/auth/google/callback`,
  isGoogleConfigured: mocks.isGoogleConfigured,
}));

vi.mock("../data/providers/google", () => ({
  startGoogleAuth: mocks.startGoogleAuth,
}));

vi.mock("../data/providers/outlook/config", () => ({
  OUTLOOK_CLIENT_ID: "test-outlook-id",
  outlookRedirectUri: (origin: string) => `${origin}/auth/outlook/callback`,
  isOutlookConfigured: mocks.isOutlookConfigured,
}));

vi.mock("../data/providers/outlook", () => ({
  startOutlookAuth: mocks.startOutlookAuth,
}));

vi.mock("./authState", () => ({
  setPostAuthRedirect: mocks.setPostAuthRedirect,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isGoogleConfigured.mockReturnValue(true);
  mocks.startGoogleAuth.mockResolvedValue(
    "https://accounts.google.com/oauth?state=google-pkce-state"
  );
  mocks.isOutlookConfigured.mockReturnValue(true);
  mocks.startOutlookAuth.mockResolvedValue(
    "https://login.microsoftonline.com/oauth?state=outlook-pkce-state"
  );
});

describe("startGoogleSignIn", () => {
  it("returns null when Google is not configured", async () => {
    mocks.isGoogleConfigured.mockReturnValue(false);
    const url = await startGoogleSignIn();
    expect(url).toBeNull();
    expect(mocks.setPostAuthRedirect).not.toHaveBeenCalled();
  });

  it("returns the auth URL when Google is configured", async () => {
    const url = await startGoogleSignIn();
    expect(url).toBe("https://accounts.google.com/oauth?state=google-pkce-state");
  });

  it("stores the returnTo path before starting OAuth", async () => {
    await startGoogleSignIn({ returnTo: "/timeline" });
    expect(mocks.setPostAuthRedirect).toHaveBeenCalledWith({
      intent: "sign-in",
      returnTo: "/timeline",
      provider: "google",
      oauthState: "google-pkce-state",
    });
  });

  it("defaults returnTo to '/' when not provided", async () => {
    await startGoogleSignIn();
    expect(mocks.setPostAuthRedirect).toHaveBeenCalledWith({
      intent: "sign-in",
      returnTo: "/",
      provider: "google",
      oauthState: "google-pkce-state",
    });
  });
  it("uses identity-only scopes for sign-in", async () => {
    await startGoogleSignIn();

    expect(mocks.startGoogleAuth).toHaveBeenCalledWith(
      expect.objectContaining({ scope: "openid email profile" })
    );
  });
});

describe("startOutlookSignIn", () => {
  it("returns null when Outlook is not configured", async () => {
    mocks.isOutlookConfigured.mockReturnValue(false);
    const url = await startOutlookSignIn();
    expect(url).toBeNull();
    expect(mocks.setPostAuthRedirect).not.toHaveBeenCalled();
  });

  it("returns the auth URL when Outlook is configured", async () => {
    const url = await startOutlookSignIn();
    expect(url).toBe("https://login.microsoftonline.com/oauth?state=outlook-pkce-state");
  });

  it("stores the returnTo path before starting OAuth", async () => {
    await startOutlookSignIn({ returnTo: "/timeline" });
    expect(mocks.setPostAuthRedirect).toHaveBeenCalledWith({
      intent: "sign-in",
      returnTo: "/timeline",
      provider: "outlook",
      oauthState: "outlook-pkce-state",
    });
  });

  it("defaults returnTo to '/' when not provided", async () => {
    await startOutlookSignIn();
    expect(mocks.setPostAuthRedirect).toHaveBeenCalledWith({
      intent: "sign-in",
      returnTo: "/",
      provider: "outlook",
      oauthState: "outlook-pkce-state",
    });
  });

  it("uses identity-only scopes for sign-in", async () => {
    await startOutlookSignIn();

    expect(mocks.startOutlookAuth).toHaveBeenCalledWith(
      expect.objectContaining({ scope: "openid profile email User.Read" })
    );
  });
});

describe("identity-link flows", () => {
  it("records a Google link-identity intent with identity-only scopes", async () => {
    await expect(startGoogleIdentityLink()).resolves.toBe(
      "https://accounts.google.com/oauth?state=google-pkce-state"
    );

    expect(mocks.setPostAuthRedirect).toHaveBeenCalledWith({
      intent: "link-identity",
      returnTo: "/settings",
      provider: "google",
      oauthState: "google-pkce-state",
    });
    expect(mocks.startGoogleAuth).toHaveBeenCalledWith(
      expect.objectContaining({ scope: "openid email profile" })
    );
  });

  it("records an Outlook link-identity intent with identity-only scopes", async () => {
    await startOutlookIdentityLink();

    expect(mocks.setPostAuthRedirect).toHaveBeenCalledWith({
      intent: "link-identity",
      returnTo: "/settings",
      provider: "outlook",
      oauthState: "outlook-pkce-state",
    });
    const [{ scope }] = mocks.startOutlookAuth.mock.calls[0] as [{ scope: string }];
    expect(scope).not.toMatch(/calendars/i);
  });

  it("returns null without recording state when the provider is not configured", async () => {
    mocks.isGoogleConfigured.mockReturnValue(false);
    mocks.isOutlookConfigured.mockReturnValue(false);

    await expect(startGoogleIdentityLink()).resolves.toBeNull();
    await expect(startOutlookIdentityLink()).resolves.toBeNull();
    expect(mocks.setPostAuthRedirect).not.toHaveBeenCalled();
  });
});

describe("startGoogleCalendarConnection", () => {
  it("records a provider-bound calendar-connection intent and requests the calendar scope", async () => {
    await startGoogleCalendarConnection();

    expect(mocks.setPostAuthRedirect).toHaveBeenCalledWith({
      intent: "connect-calendar",
      returnTo: "/settings",
      provider: "google",
      oauthState: "google-pkce-state",
    });
    expect(mocks.startGoogleAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "openid email profile https://www.googleapis.com/auth/calendar.readonly",
      })
    );
  });

  it("returns null without recording state when Google is not configured", async () => {
    mocks.isGoogleConfigured.mockReturnValue(false);

    await expect(startGoogleCalendarConnection()).resolves.toBeNull();
    expect(mocks.setPostAuthRedirect).not.toHaveBeenCalled();
  });
});

describe("startOutlookCalendarConnection", () => {
  it("records a provider-bound calendar-connection intent and requests the calendar scope", async () => {
    await startOutlookCalendarConnection();

    expect(mocks.setPostAuthRedirect).toHaveBeenCalledWith({
      intent: "connect-calendar",
      returnTo: "/settings",
      provider: "outlook",
      oauthState: "outlook-pkce-state",
    });
    expect(mocks.startOutlookAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "openid profile email User.Read Calendars.Read offline_access",
      })
    );
  });

  it("returns null without recording state when Outlook is not configured", async () => {
    mocks.isOutlookConfigured.mockReturnValue(false);

    await expect(startOutlookCalendarConnection()).resolves.toBeNull();
    expect(mocks.setPostAuthRedirect).not.toHaveBeenCalled();
  });
});
