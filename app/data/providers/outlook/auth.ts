/**
 * Microsoft identity platform OAuth 2.0 PKCE flow helpers.
 *
 * Microsoft supports S256 PKCE for public clients — same algorithm as Google,
 * but different endpoints and parameter names. We reuse the Google PKCE
 * primitives (verifier/challenge/state generation) since those are pure
 * cryptographic helpers, and provide Microsoft-specific endpoint wrappers here.
 */

import type { OutlookTokens } from "./tokenStore";

/** Identity claims used to establish an application session without calendar access. */
export const IDENTITY_SCOPE = "openid profile email User.Read";

/** Calendar.Read gives access to events in the user's primary mailbox. */
export const CALENDAR_SCOPE = "Calendars.Read offline_access openid profile";

const AUTH_ENDPOINT = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const TOKEN_ENDPOINT = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

export interface AuthUrlParams {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
  scope?: string;
}

/** Builds the Microsoft authorization URL. */
export function buildAuthUrl({
  clientId,
  redirectUri,
  codeChallenge,
  state,
  scope = CALENDAR_SCOPE,
}: AuthUrlParams): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    response_mode: "query",
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

function toTokens(res: TokenResponse, now: Date): OutlookTokens {
  return {
    accessToken: res.access_token,
    refreshToken: res.refresh_token,
    expiresAt: now.getTime() + res.expires_in * 1000,
  };
}

export interface ExchangeParams {
  clientId: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
  fetchFn?: typeof fetch;
  now?: Date;
}

/** Exchanges an authorization code for tokens using PKCE. */
export async function exchangeCodeForTokens({
  clientId,
  redirectUri,
  code,
  codeVerifier,
  fetchFn = fetch.bind(globalThis),
  now = new Date(),
}: ExchangeParams): Promise<OutlookTokens> {
  const body = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    code,
    code_verifier: codeVerifier,
    scope: CALENDAR_SCOPE,
  });

  const res = await fetchFn(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    console.error(`Outlook token exchange failed: ${res.status}`);
    throw new Error(`Outlook token exchange failed: ${res.status}`);
  }
  console.debug("Outlook token exchange successful");
  return toTokens((await res.json()) as TokenResponse, now);
}

export interface RefreshParams {
  clientId: string;
  refreshToken: string;
  fetchFn?: typeof fetch;
  now?: Date;
}

/** Refreshes an expired access token. */
export async function refreshAccessToken({
  clientId,
  refreshToken,
  fetchFn = fetch.bind(globalThis),
  now = new Date(),
}: RefreshParams): Promise<OutlookTokens> {
  console.debug("refreshing Outlook access token...");
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: CALENDAR_SCOPE,
  });

  const res = await fetchFn(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    console.error(`Outlook token refresh failed: ${res.status}`);
    throw new Error(`Outlook token refresh failed: ${res.status}`);
  }
  console.debug("Outlook access token refreshed successfully");
  const tokens = toTokens((await res.json()) as TokenResponse, now);
  return { ...tokens, refreshToken: tokens.refreshToken ?? refreshToken };
}
