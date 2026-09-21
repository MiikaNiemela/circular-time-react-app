import { describe, it, expect, vi } from "vitest";
import { buildAuthUrl, exchangeCodeForTokens, refreshAccessToken, CALENDAR_SCOPE } from "./auth";

const NOW = new Date("2026-06-19T12:00:00.000Z");

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

describe("buildAuthUrl", () => {
  it("includes all required PKCE + OAuth params for Microsoft", () => {
    const url = new URL(
      buildAuthUrl({
        clientId: "cid",
        redirectUri: "https://app/cb",
        codeChallenge: "chal",
        state: "st",
      })
    );
    const p = url.searchParams;
    expect(url.hostname).toBe("login.microsoftonline.com");
    expect(p.get("client_id")).toBe("cid");
    expect(p.get("code_challenge_method")).toBe("S256");
    expect(p.get("state")).toBe("st");
    expect(p.get("response_mode")).toBe("query");
    expect(p.get("scope")).toBe(CALENDAR_SCOPE);
  });
});

describe("exchangeCodeForTokens", () => {
  it("POSTs the verifier and returns tokens with computed expiry", async () => {
    const fetchFn = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({
        access_token: "at",
        refresh_token: "rt",
        expires_in: 3600,
        token_type: "Bearer",
      })
    );
    const tokens = await exchangeCodeForTokens({
      clientId: "cid",
      redirectUri: "https://app/cb",
      code: "code",
      codeVerifier: "verifier",
      fetchFn: fetchFn as unknown as typeof fetch,
      now: NOW,
    });
    expect(tokens.accessToken).toBe("at");
    expect(tokens.expiresAt).toBe(NOW.getTime() + 3600_000);
    const [, init] = fetchFn.mock.calls[0];
    expect((init as RequestInit).body as string).toContain("code_verifier=verifier");
  });

  it("throws on a non-ok response", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({}, false, 400));
    await expect(
      exchangeCodeForTokens({
        clientId: "c",
        redirectUri: "r",
        code: "x",
        codeVerifier: "v",
        fetchFn: fetchFn as unknown as typeof fetch,
      })
    ).rejects.toThrow(/token exchange failed: 400/);
  });
});

describe("refreshAccessToken", () => {
  it("carries the existing refresh token forward when none returned", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ access_token: "at2", expires_in: 3600, token_type: "Bearer" })
    );
    const tokens = await refreshAccessToken({
      clientId: "cid",
      refreshToken: "original-rt",
      fetchFn: fetchFn as unknown as typeof fetch,
      now: NOW,
    });
    expect(tokens.accessToken).toBe("at2");
    expect(tokens.refreshToken).toBe("original-rt");
  });

  it("throws on a non-ok response", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({}, false, 401));
    await expect(
      refreshAccessToken({
        clientId: "c",
        refreshToken: "rt",
        fetchFn: fetchFn as unknown as typeof fetch,
      })
    ).rejects.toThrow(/token refresh failed: 401/);
  });
});
