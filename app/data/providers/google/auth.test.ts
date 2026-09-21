import { describe, it, expect, vi } from "vitest";
import { buildAuthUrl, exchangeCodeForTokens, refreshAccessToken, CALENDAR_SCOPE } from "./auth";

const NOW = new Date("2026-06-19T12:00:00.000Z");

describe("buildAuthUrl", () => {
  it("includes all required PKCE + OAuth params", () => {
    const url = new URL(
      buildAuthUrl({
        clientId: "cid",
        redirectUri: "https://app/cb",
        codeChallenge: "chal",
        state: "st",
      })
    );
    const p = url.searchParams;
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(p.get("client_id")).toBe("cid");
    expect(p.get("redirect_uri")).toBe("https://app/cb");
    expect(p.get("response_type")).toBe("code");
    expect(p.get("code_challenge")).toBe("chal");
    expect(p.get("code_challenge_method")).toBe("S256");
    expect(p.get("state")).toBe("st");
    expect(p.get("scope")).toBe(CALENDAR_SCOPE);
    expect(p.get("access_type")).toBe("offline");
  });

  it("honours a custom scope", () => {
    const url = new URL(
      buildAuthUrl({
        clientId: "c",
        redirectUri: "r",
        codeChallenge: "c2",
        state: "s",
        scope: "custom",
      })
    );
    expect(url.searchParams.get("scope")).toBe("custom");
  });
});

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

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
      code: "the-code",
      codeVerifier: "the-verifier",
      fetchFn: fetchFn as unknown as typeof fetch,
      now: NOW,
    });

    expect(tokens.accessToken).toBe("at");
    expect(tokens.refreshToken).toBe("rt");
    expect(tokens.expiresAt).toBe(NOW.getTime() + 3600_000);

    const [, init] = fetchFn.mock.calls[0];
    const body = (init as RequestInit).body as string;
    expect(body).toContain("code_verifier=the-verifier");
    expect(body).toContain("grant_type=authorization_code");
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
      jsonResponse({
        access_token: "at2",
        expires_in: 3600,
        token_type: "Bearer",
      })
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
