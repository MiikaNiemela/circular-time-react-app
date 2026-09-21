import type { KeyValueStorage } from "../../cache";
import { GoogleTokenStore } from "./tokenStore";
import type { GoogleTokens } from "./tokenStore";
import { buildAuthUrl, exchangeCodeForTokens } from "./auth";
import { generateCodeVerifier, generateState, deriveCodeChallenge } from "./pkce";

/**
 * Browser-side orchestration of the PKCE flow across the redirect boundary.
 *
 * The `code_verifier` and `state` must survive the round-trip to Google and
 * back, but must NOT outlive the flow — so they live in sessionStorage (cleared
 * on tab close), keyed below. Both the start and completion steps are kept here
 * behind injectable storage so the cross-redirect handshake is testable.
 */
const VERIFIER_KEY = "circular-time-google-pkce-verifier";
const STATE_KEY = "circular-time-google-pkce-state";

function sessionStore(): KeyValueStorage {
  if (typeof sessionStorage !== "undefined") return sessionStorage;
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

export interface StartAuthOptions {
  clientId: string;
  redirectUri: string;
  /** Injectable for tests; defaults to sessionStorage. */
  storage?: KeyValueStorage;
}

/**
 * Begins the PKCE flow: generates and stashes the verifier+state, then returns
 * the authorization URL the caller should navigate to.
 */
export async function startGoogleAuth({
  clientId,
  redirectUri,
  storage = sessionStore(),
}: StartAuthOptions): Promise<string> {
  const verifier = generateCodeVerifier();
  const state = generateState();
  const codeChallenge = await deriveCodeChallenge(verifier);

  storage.setItem(VERIFIER_KEY, verifier);
  storage.setItem(STATE_KEY, state);

  return buildAuthUrl({ clientId, redirectUri, codeChallenge, state });
}

export interface CompleteAuthOptions {
  clientId: string;
  redirectUri: string;
  /** `code` query param from the callback URL. */
  code: string;
  /** `state` query param from the callback URL. */
  state: string;
  storage?: KeyValueStorage;
  tokenStore?: GoogleTokenStore;
  fetchFn?: typeof fetch;
}

/**
 * Completes the flow on the callback route: validates `state` against the
 * stashed value (CSRF defence), exchanges the code, persists tokens, and
 * returns them so the caller can forward the access token to the session endpoint.
 */
export async function completeGoogleAuth({
  clientId,
  redirectUri,
  code,
  state,
  storage = sessionStore(),
  tokenStore = new GoogleTokenStore(),
  fetchFn = fetch,
}: CompleteAuthOptions): Promise<GoogleTokens> {
  const expectedState = storage.getItem(STATE_KEY);
  const verifier = storage.getItem(VERIFIER_KEY);

  if (!expectedState || state !== expectedState) {
    throw new Error("OAuth state mismatch — possible CSRF, aborting");
  }
  if (!verifier) {
    throw new Error("Missing PKCE verifier — restart the sign-in");
  }

  const tokens = await exchangeCodeForTokens({
    clientId,
    redirectUri,
    code,
    codeVerifier: verifier,
    fetchFn,
  });
  tokenStore.set(tokens);

  // One-time secrets: clear so they cannot be replayed.
  storage.removeItem(VERIFIER_KEY);
  storage.removeItem(STATE_KEY);
  return tokens;
}
