/**
 * Shared completion rules for the Google and Outlook OAuth callbacks.
 * Each intent posts its verified access token to exactly one server endpoint.
 */
import type { OAuthIntent } from "./authState";

/** The server endpoint that completes each OAuth intent. */
export const OAUTH_ENDPOINTS: Record<OAuthIntent, string> = {
  "sign-in": "/auth/session",
  "link-identity": "/auth/identity-link",
  "connect-calendar": "/auth/calendar-connection",
};

const FALLBACK_ERRORS: Record<OAuthIntent, string> = {
  "sign-in": "Unable to establish the application session.",
  "link-identity": "Unable to link the account.",
  "connect-calendar": "Unable to connect the calendar.",
};

/**
 * Returns the server's user-facing error for a failed completion, so a linking
 * conflict explains itself; falls back to a generic message per intent.
 */
export async function responseError(response: Response, intent: OAuthIntent): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "error" in body) {
      const { error } = body as { error?: unknown };
      if (typeof error === "string" && error.length > 0) return error;
    }
  } catch {
    // A non-JSON error body falls through to the generic message.
  }
  return FALLBACK_ERRORS[intent];
}
