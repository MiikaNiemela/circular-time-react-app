import type { GoogleTokens } from "./tokenStore";

/**
 * Google OAuth 2.0 endpoints and the Authorization Code + PKCE flow.
 *
 * Network calls take an injectable `fetch` so the flow is unit-testable without
 * hitting Google. `buildAuthUrl` is pure.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
// Token exchange/refresh is proxied through our own server route, which injects
// the confidential client secret Google requires for "Web application" clients.
// The browser never sees the secret; PKCE's code_verifier is still sent.
const TOKEN_ENDPOINT = "/auth/google/token";

/** Identity claims used to establish an application session without calendar access. */
export const IDENTITY_SCOPE = "openid email profile";

/** Read-only access to the user's calendar events. */
export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

export interface AuthUrlParams {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
  /** Space-separated scopes; defaults to read-only calendar. */
  scope?: string;
}

/** Builds the authorization URL the browser redirects to. */
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
    // Request a refresh token so access survives past the ~1h access token.
    access_type: "offline",
    // Force consent so a refresh token is returned even on re-auth.
    prompt: "consent",
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

/** Raw token endpoint response (snake_case as Google returns it). */
interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

function toTokens(res: TokenResponse, now: Date): GoogleTokens {
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

/** Exchanges an authorization code for tokens (PKCE: sends the verifier). */
export async function exchangeCodeForTokens({
  clientId,
  redirectUri,
  code,
  codeVerifier,
  fetchFn = fetch.bind(globalThis),
  now = new Date(),
}: ExchangeParams): Promise<GoogleTokens> {
  const body = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    code,
    code_verifier: codeVerifier,
  });

  const res = await fetchFn(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${res.status}`);
  }
  return toTokens((await res.json()) as TokenResponse, now);
}

export interface RefreshParams {
  clientId: string;
  refreshToken: string;
  fetchFn?: typeof fetch;
  now?: Date;
}

/**
 * Exchanges a refresh token for a fresh access token. Google omits a new
 * refresh token on refresh, so we carry the existing one forward.
 */
export async function refreshAccessToken({
  clientId,
  refreshToken,
  fetchFn = fetch.bind(globalThis),
  now = new Date(),
}: RefreshParams): Promise<GoogleTokens> {
  console.debug("refreshing Google access token...");
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const res = await fetchFn(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    console.error(`Google token refresh failed: ${res.status}`);
    throw new Error(`Google token refresh failed: ${res.status}`);
  }
  console.debug("Google access token refreshed successfully");
  const tokens = toTokens((await res.json()) as TokenResponse, now);
  // Preserve the refresh token if the response did not include one.
  return { ...tokens, refreshToken: tokens.refreshToken ?? refreshToken };
}
