/**
 * Server-side helpers that fetch a caller's stable user ID from each provider's
 * identity endpoint. Using the access token server-side (rather than trusting a
 * client-supplied claim) ensures the identity is actually verified by the provider.
 */

const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const GOOGLE_CALENDAR_LIST_URL =
  "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1";
const OUTLOOK_ME_URL = "https://graph.microsoft.com/v1.0/me";
const OUTLOOK_CALENDAR_LIST_URL = "https://graph.microsoft.com/v1.0/me/calendars?$top=1";

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

/** Verifies that a Google token has calendar-read authorization. */
export async function verifyGoogleCalendarAccess(
  accessToken: string,
  fetchFn: typeof fetch = fetch
): Promise<void> {
  const res = await fetchFn(GOOGLE_CALENDAR_LIST_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Google calendar access failed: ${res.status}`);
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

/** Verifies that an Outlook token has calendar-read authorization. */
export async function verifyOutlookCalendarAccess(
  accessToken: string,
  fetchFn: typeof fetch = fetch
): Promise<void> {
  const res = await fetchFn(OUTLOOK_CALENDAR_LIST_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Outlook calendar access failed: ${res.status}`);
}
