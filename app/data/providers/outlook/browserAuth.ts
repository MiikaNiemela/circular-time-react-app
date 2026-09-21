import type { KeyValueStorage } from "../../cache";
import { OutlookTokenStore } from "./tokenStore";
import type { OutlookTokens } from "./tokenStore";
import { buildAuthUrl, exchangeCodeForTokens } from "./auth";
import { generateCodeVerifier, generateState, deriveCodeChallenge } from "../google/pkce";

const VERIFIER_KEY = "circular-time-outlook-pkce-verifier";
const STATE_KEY = "circular-time-outlook-pkce-state";

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
  storage?: KeyValueStorage;
}

export async function startOutlookAuth({
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
  code: string;
  state: string;
  storage?: KeyValueStorage;
  tokenStore?: OutlookTokenStore;
  fetchFn?: typeof fetch;
}

export async function completeOutlookAuth({
  clientId,
  redirectUri,
  code,
  state,
  storage = sessionStore(),
  tokenStore = new OutlookTokenStore(),
  fetchFn = fetch,
}: CompleteAuthOptions): Promise<OutlookTokens> {
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

  storage.removeItem(VERIFIER_KEY);
  storage.removeItem(STATE_KEY);
  return tokens;
}
