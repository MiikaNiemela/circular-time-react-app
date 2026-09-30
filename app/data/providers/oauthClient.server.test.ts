import { describe, it, expect, vi } from "vitest";
import { exchangeAuthorizationCode, refreshProviderTokens } from "./oauthClient.server";

const NOW = new Date("2026-10-01T12:00:00Z");
const CREDENTIALS = { clientId: "client-id", clientSecret: "client-secret" };

function tokenResponse(body: unknown, status = 200) {
  return vi.fn(
    async (_url: RequestInfo | URL, _init?: RequestInit) =>
      ({ ok: status < 400, status, json: async () => body }) as Response
  );
}

function sentBody(fetchFn: ReturnType<typeof tokenResponse>): URLSearchParams {
  return new URLSearchParams(String(fetchFn.mock.calls[0][1]?.body));
}

describe("exchangeAuthorizationCode", () => {
  it("redeems the code with the PKCE verifier and the server-held client secret", async () => {
    const fetchFn = tokenResponse({ access_token: "at", refresh_token: "rt", expires_in: 3600 });

    const tokens = await exchangeAuthorizationCode(
      "google",
      { code: "code", codeVerifier: "verifier", redirectUri: "https://app/auth/google/callback" },
      CREDENTIALS,
      fetchFn,
      NOW
    );

    expect(fetchFn.mock.calls[0][0]).toBe("https://oauth2.googleapis.com/token");
    expect(Object.fromEntries(sentBody(fetchFn))).toEqual({
      grant_type: "authorization_code",
      code: "code",
      code_verifier: "verifier",
      redirect_uri: "https://app/auth/google/callback",
      client_id: "client-id",
      client_secret: "client-secret",
    });
    expect(tokens).toEqual({
      accessToken: "at",
      refreshToken: "rt",
      expiresAt: NOW.getTime() + 3_600_000,
    });
  });

  it("uses the Microsoft token endpoint for Outlook", async () => {
    const fetchFn = tokenResponse({ access_token: "at", expires_in: 60 });

    await exchangeAuthorizationCode(
      "outlook",
      { code: "c", codeVerifier: "v", redirectUri: "r" },
      CREDENTIALS,
      fetchFn,
      NOW
    );

    expect(fetchFn.mock.calls[0][0]).toBe(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token"
    );
  });

  it("fails without echoing the provider response on an error status", async () => {
    const fetchFn = tokenResponse({ error: "invalid_grant", error_description: "detail" }, 400);

    await expect(
      exchangeAuthorizationCode(
        "google",
        { code: "c", codeVerifier: "v", redirectUri: "r" },
        CREDENTIALS,
        fetchFn,
        NOW
      )
    ).rejects.toThrow("google token endpoint failed: 400");
  });

  it("fails when the response carries no access token", async () => {
    const fetchFn = tokenResponse({ expires_in: 60 });

    await expect(
      exchangeAuthorizationCode(
        "google",
        { code: "c", codeVerifier: "v", redirectUri: "r" },
        CREDENTIALS,
        fetchFn,
        NOW
      )
    ).rejects.toThrow("returned no access token");
  });
});

describe("refreshProviderTokens", () => {
  it("carries the refresh token forward when the provider omits a new one", async () => {
    const fetchFn = tokenResponse({ access_token: "new-at", expires_in: 3600 });

    const tokens = await refreshProviderTokens("google", "old-rt", CREDENTIALS, fetchFn, NOW);

    expect(Object.fromEntries(sentBody(fetchFn))).toEqual({
      grant_type: "refresh_token",
      refresh_token: "old-rt",
      client_id: "client-id",
      client_secret: "client-secret",
    });
    expect(tokens.refreshToken).toBe("old-rt");
    expect(tokens.accessToken).toBe("new-at");
  });

  it("keeps a rotated refresh token and sends the calendar scope for Outlook", async () => {
    const fetchFn = tokenResponse({ access_token: "at", refresh_token: "rotated", expires_in: 60 });

    const tokens = await refreshProviderTokens("outlook", "old-rt", CREDENTIALS, fetchFn, NOW);

    expect(sentBody(fetchFn).get("scope")).toContain("Calendars.Read");
    expect(tokens.refreshToken).toBe("rotated");
  });
});
