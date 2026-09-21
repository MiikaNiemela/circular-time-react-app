import { describe, it, expect, beforeEach } from "vitest";
import { GoogleTokenStore, type GoogleTokens } from "./tokenStore";
import type { KeyValueStorage } from "../../cache";

function memoryStorage(): KeyValueStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

const NOW = new Date("2026-06-19T12:00:00.000Z");

function tokens(expiresAt: number): GoogleTokens {
  return { accessToken: "at", refreshToken: "rt", expiresAt };
}

describe("GoogleTokenStore", () => {
  let storage: KeyValueStorage;

  beforeEach(() => {
    storage = memoryStorage();
  });

  it("returns null when nothing stored", () => {
    expect(new GoogleTokenStore(storage).get()).toBeNull();
  });

  it("stores and retrieves tokens", () => {
    const store = new GoogleTokenStore(storage);
    const t = tokens(NOW.getTime() + 3600_000);
    store.set(t);
    expect(store.get()).toEqual(t);
  });

  it("clears tokens", () => {
    const store = new GoogleTokenStore(storage);
    store.set(tokens(NOW.getTime() + 3600_000));
    store.clear();
    expect(store.get()).toBeNull();
  });

  it("treats a missing token as expired", () => {
    expect(new GoogleTokenStore(storage).isExpired(NOW)).toBe(true);
  });

  it("is not expired well before expiry", () => {
    const store = new GoogleTokenStore(storage);
    store.set(tokens(NOW.getTime() + 3600_000));
    expect(store.isExpired(NOW)).toBe(false);
  });

  it("is expired within the skew window", () => {
    const store = new GoogleTokenStore(storage);
    // Expires in 30s; skew is 60s → considered expired.
    store.set(tokens(NOW.getTime() + 30_000));
    expect(store.isExpired(NOW)).toBe(true);
  });

  it("recovers from corrupt stored data", () => {
    storage.setItem("circular-time-google-tokens", "{bad json");
    expect(new GoogleTokenStore(storage).get()).toBeNull();
  });
});
