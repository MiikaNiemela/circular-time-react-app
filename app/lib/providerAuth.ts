/**
 * Business-logic wrappers that start OAuth flows for each calendar provider.
 *
 * Keeps the UI layer free of direct data-provider imports per the architecture
 * rule that UI never touches calendar APIs directly. The `sign-in` and
 * `settings` routes call these instead of importing from `app/data/providers/`.
 */

import { startGoogleAuth } from "../data/providers/google";
import { IDENTITY_SCOPE as GOOGLE_IDENTITY_SCOPE } from "../data/providers/google/auth";
import {
  GOOGLE_CLIENT_ID,
  googleRedirectUri,
  isGoogleConfigured,
} from "../data/providers/google/config";
import { startOutlookAuth } from "../data/providers/outlook";
import { IDENTITY_SCOPE as OUTLOOK_IDENTITY_SCOPE } from "../data/providers/outlook/auth";
import {
  OUTLOOK_CLIENT_ID,
  isOutlookConfigured,
  outlookRedirectUri,
} from "../data/providers/outlook/config";
import { setPostAuthRedirect } from "./authState";

/** Options for the OAuth sign-in initiators. */
export interface StartSignInOptions {
  /** Where to redirect after OAuth completes; defaults to the timeline root. */
  returnTo?: string;
}

/**
 * Begins the Google OAuth PKCE flow for sign-in and returns the authorization
 * URL to navigate to, or null when Google is not configured for this build.
 */
export async function startGoogleSignIn({ returnTo = "/" }: StartSignInOptions = {}): Promise<
  string | null
> {
  if (!isGoogleConfigured()) return null;
  setPostAuthRedirect({ intent: "sign-in", returnTo });
  return startGoogleAuth({
    clientId: GOOGLE_CLIENT_ID,
    redirectUri: googleRedirectUri(window.location.origin),
    scope: GOOGLE_IDENTITY_SCOPE,
  });
}

/**
 * Begins the Outlook OAuth PKCE flow for sign-in and returns the authorization
 * URL to navigate to, or null when Outlook is not configured for this build.
 */
export async function startOutlookSignIn({ returnTo = "/" }: StartSignInOptions = {}): Promise<
  string | null
> {
  if (!isOutlookConfigured()) return null;
  setPostAuthRedirect({ intent: "sign-in", returnTo });
  return startOutlookAuth({
    clientId: OUTLOOK_CLIENT_ID,
    redirectUri: outlookRedirectUri(window.location.origin),
    scope: OUTLOOK_IDENTITY_SCOPE,
  });
}
