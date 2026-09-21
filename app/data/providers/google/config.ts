/**
 * Build-time configuration for the Google provider.
 *
 * `VITE_GOOGLE_CLIENT_ID` is a PUBLIC OAuth client ID (PKCE has no secret), so
 * exposing it to the browser bundle is expected. It is injected at build time
 * from a GitHub Actions secret. When unset (local dev without credentials), the
 * UI degrades gracefully rather than crashing.
 */
export const GOOGLE_CLIENT_ID: string =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? "";

/** The OAuth redirect URI must exactly match one registered in Google Cloud. */
export function googleRedirectUri(origin: string): string {
  return `${origin}/auth/google/callback`;
}

/** Whether Google integration is configured for this build. */
export function isGoogleConfigured(): boolean {
  return GOOGLE_CLIENT_ID.length > 0;
}
