/**
 * Google OAuth 2.0 authorization request and scopes. The server builds the
 * authorization URL; the code exchange and refresh live in
 * ../oauthClient.server.ts, authenticated with the confidential client secret.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";

/** Identity claims used to establish an application session without calendar access. */
export const IDENTITY_SCOPE = "openid email profile";

/** Read-only access to the user's calendar events. */
export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

/** Calendar access plus the identity claims needed to bind the connection to the signed-in account. */
export const CALENDAR_CONNECTION_SCOPE = `${IDENTITY_SCOPE} ${CALENDAR_SCOPE}`;

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
