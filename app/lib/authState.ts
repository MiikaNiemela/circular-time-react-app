/**
 * Declares what an OAuth completion does: sign in, link another sign-in
 * identity to the current account, or connect a calendar.
 */
export type OAuthIntent = "sign-in" | "link-identity" | "connect-calendar";

const OAUTH_INTENTS: readonly OAuthIntent[] = ["sign-in", "link-identity", "connect-calendar"];

/** Holds one browser-local OAuth flow, bound to its provider and PKCE state. */
export interface PendingOAuthFlow {
  intent: OAuthIntent;
  returnTo: string;
  provider: "google" | "outlook";
  oauthState: string;
}

const POST_AUTH_KEY = "circular-time-post-auth-redirect";

function isPendingOAuthFlow(value: unknown): value is PendingOAuthFlow {
  if (!value || typeof value !== "object") return false;
  const flow = value as Record<string, unknown>;
  return (
    OAUTH_INTENTS.includes(flow.intent as OAuthIntent) &&
    typeof flow.returnTo === "string" &&
    (flow.provider === "google" || flow.provider === "outlook") &&
    typeof flow.oauthState === "string" &&
    flow.oauthState.length > 0
  );
}

/**
 * Stores the purpose and local destination for one OAuth round trip.
 * The callback consumes the state before it creates a server session or links a
 * calendar, so a completed authorization response cannot be replayed locally.
 */
export function setPostAuthRedirect(flow: PendingOAuthFlow): void {
  sessionStorage.setItem(POST_AUTH_KEY, JSON.stringify(flow));
}

/**
 * Reads and removes the pending OAuth flow. Malformed state is discarded.
 */
export function consumePostAuthRedirect(): PendingOAuthFlow | null {
  const raw = sessionStorage.getItem(POST_AUTH_KEY);
  if (!raw) return null;

  sessionStorage.removeItem(POST_AUTH_KEY);
  try {
    const flow: unknown = JSON.parse(raw);
    return isPendingOAuthFlow(flow) ? flow : null;
  } catch {
    return null;
  }
}
