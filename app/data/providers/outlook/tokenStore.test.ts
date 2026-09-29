import { describe, expect, it } from "vitest";
import { OutlookTokenStore } from "./tokenStore";
import type { KeyValueStorage } from "../../cache";

function memoryStorage(): KeyValueStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

describe("OutlookTokenStore", () => {
  it("rejects legacy tokens that are not bound to an immutable calendar connection", () => {
    const storage = memoryStorage();
    storage.setItem(
      "circular-time-outlook-tokens",
      JSON.stringify({ accessToken: "old", expiresAt: Date.now() + 3600_000 })
    );

    expect(new OutlookTokenStore(storage).get()).toBeNull();
  });
});
