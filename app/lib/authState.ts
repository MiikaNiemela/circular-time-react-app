/**
 * Client-only auth gate: the user is considered authenticated when at least
 * one calendar provider has tokens in localStorage. Milestone 5.2 will replace
 * this with a server-side session check.
 *
 * Post-auth redirect: callers that start OAuth from the sign-in route store a
 * return URL in sessionStorage before redirecting; the OAuth callbacks read it
 * via consumePostAuthRedirect to land back at the original destination instead
 * of the default /settings page.
 */

import { useSyncExternalStore } from "react";
import { GoogleTokenStore } from "../data/providers/google";
import { OutlookTokenStore } from "../data/providers/outlook";

const POST_AUTH_KEY = "circular-time-post-auth-redirect";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function isAuthenticatedSnapshot(): boolean {
  return new GoogleTokenStore().get() !== null || new OutlookTokenStore().get() !== null;
}

// The server has no localStorage; all visitors are unauthenticated from the
// server's perspective — the client resolves the real value after hydration.
const isAuthenticatedServerSnapshot = (): boolean => false;

/**
 * True when at least one calendar provider has tokens in localStorage;
 * false during SSR and the first client render until hydration resolves it.
 */
export function useIsAuthenticated(): boolean {
  return useSyncExternalStore(subscribe, isAuthenticatedSnapshot, isAuthenticatedServerSnapshot);
}

/**
 * Stores the URL to navigate to after a successful OAuth sign-in.
 * Call this before starting OAuth from the sign-in gate so the callback
 * knows where to send the user instead of the default /settings destination.
 */
export function setPostAuthRedirect(returnTo: string): void {
  sessionStorage.setItem(POST_AUTH_KEY, returnTo);
}

/**
 * Reads and removes the stored post-auth return URL.
 * Returns null when OAuth was started from Settings (no redirect was stored).
 */
export function consumePostAuthRedirect(): string | null {
  const url = sessionStorage.getItem(POST_AUTH_KEY);
  if (url) sessionStorage.removeItem(POST_AUTH_KEY);
  return url;
}
