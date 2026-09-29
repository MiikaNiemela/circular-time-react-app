import type { KeyValueStorage } from "../../cache";

export interface OutlookTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

export interface StoredOutlookTokens extends OutlookTokens {
  /** Immutable server-issued ID of the calendar connection this token authorized. */
  calendarConnectionId: string;
}

const STORAGE_KEY = "circular-time-outlook-tokens";
const EXPIRY_SKEW_MS = 60_000;

export class OutlookTokenStore {
  constructor(private readonly storage: KeyValueStorage = defaultStorage()) {}

  get(): StoredOutlookTokens | null {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (!raw) {
      console.debug("No Outlook tokens found");
      return null;
    }
    try {
      const tokens: unknown = JSON.parse(raw);
      const record: Record<string, unknown> | null =
        typeof tokens === "object" && tokens !== null ? (tokens as Record<string, unknown>) : null;
      if (
        typeof record?.calendarConnectionId !== "string" ||
        record.calendarConnectionId.length === 0
      ) {
        this.clear();
        return null;
      }
      return tokens as StoredOutlookTokens;
    } catch {
      console.debug("Failed to parse Outlook tokens");
      return null;
    }
  }

  set(tokens: StoredOutlookTokens): void {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  }

  clear(): void {
    this.storage.removeItem(STORAGE_KEY);
  }

  isExpired(now: Date = new Date()): boolean {
    const tokens = this.get();
    if (!tokens) {
      console.debug("Outlook access token is expired");
      return true;
    }
    const expired = now.getTime() >= tokens.expiresAt - EXPIRY_SKEW_MS;
    if (expired) {
      console.debug("Outlook access token is expired");
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
