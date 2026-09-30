/**
 * Microsoft identity platform OAuth 2.0 authorization request and scopes. The
 * server builds the authorization URL with an S256 PKCE challenge; the code
 * exchange and refresh live in ../oauthClient.server.ts, authenticated with
 * the confidential (Web platform) client secret.
 */

/** Identity claims used to establish an application session without calendar access. */
export const IDENTITY_SCOPE = "openid profile email User.Read";

/** Calendar.Read gives access to events in the user's primary mailbox. */
export const CALENDAR_SCOPE = "Calendars.Read offline_access openid profile";

/**
 * Calendar access plus the identity claims needed to bind the connection to the
 * signed-in account. Kept de-duplicated because OAuth scope is a set.
 */
export const CALENDAR_CONNECTION_SCOPE =
  "openid profile email User.Read Calendars.Read offline_access";

const AUTH_ENDPOINT = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";

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
