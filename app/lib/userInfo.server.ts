/**
 * Server-side helpers that fetch a caller's stable user ID from each provider's
 * identity endpoint. Using the access token server-side (rather than trusting a
 * client-supplied claim) ensures the identity is actually verified by the provider.
 */

const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const OUTLOOK_ME_URL = "https://graph.microsoft.com/v1.0/me";

/**
 * Fetches the Google user's stable `sub` claim via the userinfo endpoint.
 * Throws when the token is rejected or the response is missing the `sub` field.
 */
export async function fetchGoogleUserId(
  accessToken: string,
  fetchFn: typeof fetch = fetch
): Promise<string> {
  const res = await fetchFn(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Google userinfo failed: ${res.status}`);
  const { sub } = (await res.json()) as { sub?: string };
  if (!sub) throw new Error("Google userinfo response missing sub claim");
  return sub;
}

/**
 * Fetches the Outlook user's stable `id` from the Microsoft Graph /me endpoint.
 * Throws when the token is rejected or the response is missing the `id` field.
 */
export async function fetchOutlookUserId(
  accessToken: string,
  fetchFn: typeof fetch = fetch
): Promise<string> {
  const res = await fetchFn(OUTLOOK_ME_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Outlook /me failed: ${res.status}`);
  const { id } = (await res.json()) as { id?: string };
  if (!id) throw new Error("Outlook /me response missing id field");
  return id;
}
