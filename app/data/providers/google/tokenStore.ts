import type { KeyValueStorage } from "../../cache";

/**
 * OAuth tokens for Google, plus the absolute expiry instant.
 *
 * NOTE on security: this stores tokens in Web Storage (localStorage) — the
 * simplest option for a public PKCE client and the one chosen for this app.
 * The tradeoff is XSS exposure: any injected script could read these. There is
 * no client secret to leak (PKCE), and refresh tokens are scoped narrowly, but
 * if the threat model tightens later, move this behind an HttpOnly cookie set
 * by a server route. Keeping the store behind this interface makes that swap
 * local to this file.
 */
export interface GoogleTokens {
  accessToken: string;
  /** May be absent if Google did not return one (e.g. no `access_type=offline`). */
  refreshToken?: string;
  /** Epoch milliseconds when the access token expires. */
  expiresAt: number;
}

const STORAGE_KEY = "circular-time-google-tokens";

/** Refresh slightly early to avoid races against the exact expiry instant. */
const EXPIRY_SKEW_MS = 60_000;

/** Persists Google OAuth tokens behind an injectable storage. */
export class GoogleTokenStore {
  constructor(private readonly storage: KeyValueStorage = defaultStorage()) {}

  get(): GoogleTokens | null {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (!raw) {
      console.debug("No Google tokens found");
      return null;
    }
    try {
      return JSON.parse(raw) as GoogleTokens;
    } catch {
      console.debug("Failed to parse Google tokens");
      return null;
    }
  }

  set(tokens: GoogleTokens): void {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  }

  clear(): void {
    this.storage.removeItem(STORAGE_KEY);
  }

  /** True when there is no token or it is within the skew window of expiry. */
  isExpired(now: Date = new Date()): boolean {
    const tokens = this.get();
    if (!tokens) {
      console.debug("Google access token is expired");
      return true;
    }
    const expired = now.getTime() >= tokens.expiresAt - EXPIRY_SKEW_MS;
    if (expired) {
      console.debug("Google access token is expired");
    }
    return expired;
  }
}

function defaultStorage(): KeyValueStorage {
  if (typeof localStorage !== "undefined") return localStorage;
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}
