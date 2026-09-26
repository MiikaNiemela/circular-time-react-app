import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  completeOutlookAuth: vi.fn(),
  consumePostAuthRedirect: vi.fn(),
  navigate: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("../data/providers/outlook", () => ({ completeOutlookAuth: mocks.completeOutlookAuth }));
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
  mocks.consumePostAuthRedirect.mockReturnValue({ intent: "sign-in", returnTo: "/" });
  mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
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

    const [, request] = mocks.fetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(request.body))).toEqual({
      intent: "sign-in",
      provider: "outlook",
      accessToken: "identity-access-token",
    });
    expect(mocks.navigate).toHaveBeenCalledWith("/", { replace: true });
  });
});
