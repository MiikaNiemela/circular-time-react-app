import { describe, it, expect, vi, beforeEach } from "vitest";
import { startGoogleSignIn, startOutlookSignIn } from "./providerAuth";

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
  mocks.startGoogleAuth.mockResolvedValue("https://accounts.google.com/oauth");
  mocks.isOutlookConfigured.mockReturnValue(true);
  mocks.startOutlookAuth.mockResolvedValue("https://login.microsoftonline.com/oauth");
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
    expect(url).toBe("https://accounts.google.com/oauth");
  });

  it("stores the returnTo path before starting OAuth", async () => {
    await startGoogleSignIn({ returnTo: "/timeline" });
    expect(mocks.setPostAuthRedirect).toHaveBeenCalledWith({
      intent: "sign-in",
      returnTo: "/timeline",
    });
  });

  it("defaults returnTo to '/' when not provided", async () => {
    await startGoogleSignIn();
    expect(mocks.setPostAuthRedirect).toHaveBeenCalledWith({
      intent: "sign-in",
      returnTo: "/",
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
    expect(url).toBe("https://login.microsoftonline.com/oauth");
  });

  it("stores the returnTo path before starting OAuth", async () => {
    await startOutlookSignIn({ returnTo: "/timeline" });
    expect(mocks.setPostAuthRedirect).toHaveBeenCalledWith({
      intent: "sign-in",
      returnTo: "/timeline",
    });
  });

  it("defaults returnTo to '/' when not provided", async () => {
    await startOutlookSignIn();
    expect(mocks.setPostAuthRedirect).toHaveBeenCalledWith({
      intent: "sign-in",
      returnTo: "/",
    });
  });

  it("uses identity-only scopes for sign-in", async () => {
    await startOutlookSignIn();

    expect(mocks.startOutlookAuth).toHaveBeenCalledWith(
      expect.objectContaining({ scope: "openid profile email User.Read" })
    );
  });
});
