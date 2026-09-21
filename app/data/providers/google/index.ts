/**
 * Public surface of the Google Calendar provider.
 *
 * The OAuth flow (PKCE) is split into pure helpers + injectable-fetch network
 * calls so the whole provider is testable without a browser or live Google.
 */
export { GoogleCalendarProvider } from "./GoogleCalendarProvider";
export type { GoogleProviderConfig } from "./GoogleCalendarProvider";
export { GoogleTokenStore } from "./tokenStore";
export type { GoogleTokens } from "./tokenStore";
export { buildAuthUrl, exchangeCodeForTokens, refreshAccessToken, CALENDAR_SCOPE } from "./auth";
export { generateCodeVerifier, generateState, deriveCodeChallenge } from "./pkce";
export { startGoogleAuth, completeGoogleAuth } from "./browserAuth";
export type { StartAuthOptions, CompleteAuthOptions } from "./browserAuth";
