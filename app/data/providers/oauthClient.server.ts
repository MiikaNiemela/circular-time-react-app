/**
 * Server-side OAuth 2.0 token endpoint client for Google and Microsoft.
 *
 * Both apps are confidential web clients: the authorization-code exchange and
 * every refresh are authenticated with the client secret, which never leaves
 * the server. PKCE's code_verifier is still sent with the code exchange.
 * Network calls take an injectable `fetch` so the flow is unit-testable.
 */
import { CALENDAR_SCOPE as OUTLOOK_CALENDAR_SCOPE } from "./outlook/auth";

export type OAuthProviderId = "google" | "outlook";

/** Tokens returned by a provider token endpoint, with an absolute expiry. */
export interface ProviderTokens {
  accessToken: string;
  /** Absent when the provider did not issue one (e.g. on some refreshes). */
  refreshToken?: string;
  /** Epoch milliseconds when the access token expires. */
  expiresAt: number;
}

export interface OAuthClientCredentials {
  clientId: string;
  clientSecret: string;
}

const TOKEN_ENDPOINTS: Record<OAuthProviderId, string> = {
  google: "https://oauth2.googleapis.com/token",
  outlook: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
};

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}

async function requestTokens(
  provider: OAuthProviderId,
  params: Record<string, string>,
  credentials: OAuthClientCredentials,
  fetchFn: typeof fetch,
  now: Date
): Promise<ProviderTokens> {
  const body = new URLSearchParams({
    ...params,
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
  });
  const res = await fetchFn(TOKEN_ENDPOINTS[provider], {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    // The response body can echo request details; log only the status.
    throw new Error(`${provider} token endpoint failed: ${res.status}`);
  }
  const json = (await res.json()) as TokenResponse;
  if (!json.access_token || typeof json.expires_in !== "number") {
    throw new Error(`${provider} token endpoint returned no access token`);
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: now.getTime() + json.expires_in * 1000,
  };
}

export interface CodeExchange {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}

/** Redeems an authorization code (with its PKCE verifier) for tokens. */
export function exchangeAuthorizationCode(
  provider: OAuthProviderId,
  { code, codeVerifier, redirectUri }: CodeExchange,
  credentials: OAuthClientCredentials,
  fetchFn: typeof fetch = fetch,
  now: Date = new Date()
): Promise<ProviderTokens> {
  return requestTokens(
    provider,
    {
      grant_type: "authorization_code",
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
    },
    credentials,
    fetchFn,
    now
  );
}

/**
 * Exchanges a refresh token for a new access token. Providers may omit a new
 * refresh token (Google always does), so the existing one is carried forward.
 */
export async function refreshProviderTokens(
  provider: OAuthProviderId,
  refreshToken: string,
  credentials: OAuthClientCredentials,
  fetchFn: typeof fetch = fetch,
  now: Date = new Date()
): Promise<ProviderTokens> {
  const params: Record<string, string> = {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  };
  // Microsoft requires the scope on refresh; Google rejects nothing but needs none.
  if (provider === "outlook") params.scope = OUTLOOK_CALENDAR_SCOPE;
  const tokens = await requestTokens(provider, params, credentials, fetchFn, now);
  return { ...tokens, refreshToken: tokens.refreshToken ?? refreshToken };
}
