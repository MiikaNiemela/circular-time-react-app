import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  completeGoogleAuth: vi.fn(),
  consumePostAuthRedirect: vi.fn(),
  navigate: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("../data/providers/google", () => ({ completeGoogleAuth: mocks.completeGoogleAuth }));
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
  mocks.consumePostAuthRedirect.mockReturnValue({ intent: "sign-in", returnTo: "/" });
  mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
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

    const [, request] = mocks.fetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(request.body))).toEqual({
      intent: "sign-in",
      provider: "google",
      accessToken: "identity-access-token",
    });
    expect(mocks.navigate).toHaveBeenCalledWith("/", { replace: true });
  });
});
