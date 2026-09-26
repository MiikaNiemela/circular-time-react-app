import { describe, it, expect, vi } from "vitest";
import { startOutlookAuth, completeOutlookAuth } from "./browserAuth";
import { OutlookTokenStore } from "./tokenStore";
import type { KeyValueStorage } from "../../cache";

function memoryStorage(): KeyValueStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

describe("startOutlookAuth", () => {
  it("stashes verifier+state and returns a Microsoft auth URL", async () => {
    const storage = memoryStorage();
    const url = new URL(
      await startOutlookAuth({ clientId: "cid", redirectUri: "https://app/cb", storage })
    );
    expect(url.hostname).toBe("login.microsoftonline.com");
    const state = url.searchParams.get("state");
    expect(state).toBeTruthy();
    expect(storage.getItem("circular-time-outlook-pkce-state")).toBe(state);
    expect(storage.getItem("circular-time-outlook-pkce-verifier")).toBeTruthy();
  });
  it("uses the requested scope for an identity-only sign-in", async () => {
    const storage = memoryStorage();
    const url = new URL(
      await startOutlookAuth({
        clientId: "cid",
        redirectUri: "https://app/cb",
        scope: "openid profile email User.Read",
        storage,
      })
    );

    expect(url.searchParams.get("scope")).toBe("openid profile email User.Read");
  });
});

describe("completeOutlookAuth", () => {
  it("validates state, exchanges code, stores tokens, clears secrets", async () => {
    const storage = memoryStorage();
    await startOutlookAuth({ clientId: "cid", redirectUri: "https://app/cb", storage });
    const state = storage.getItem("circular-time-outlook-pkce-state")!;

    const fetchFn = vi.fn(async () =>
      jsonResponse({
        access_token: "at",
        refresh_token: "rt",
        expires_in: 3600,
        token_type: "Bearer",
      })
    );
    const tokenStore = new OutlookTokenStore(memoryStorage());

    const tokens = await completeOutlookAuth({
      clientId: "cid",
      redirectUri: "https://app/cb",
      code: "authcode",
      state,
      storage,
      tokenStore,
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    expect(tokens.accessToken).toBe("at");
    expect(tokenStore.get()?.accessToken).toBe("at");
    expect(storage.getItem("circular-time-outlook-pkce-state")).toBeNull();
    expect(storage.getItem("circular-time-outlook-pkce-verifier")).toBeNull();
  });

  it("does not persist calendar tokens for an identity-only sign-in", async () => {
    const storage = memoryStorage();
    await startOutlookAuth({ clientId: "cid", redirectUri: "https://app/cb", storage });
    const state = storage.getItem("circular-time-outlook-pkce-state")!;
    const tokenStore = new OutlookTokenStore(memoryStorage());

    await completeOutlookAuth({
      clientId: "cid",
      redirectUri: "https://app/cb",
      code: "authcode",
      state,
      storage,
      tokenStore,
      persistTokens: false,
      fetchFn: (async () =>
        jsonResponse({
          access_token: "identity-token",
          expires_in: 3600,
          token_type: "Bearer",
        })) as unknown as typeof fetch,
    });

    expect(tokenStore.get()).toBeNull();
  });

  it("rejects a mismatched state", async () => {
    const storage = memoryStorage();
    await startOutlookAuth({ clientId: "cid", redirectUri: "https://app/cb", storage });
    await expect(
      completeOutlookAuth({
        clientId: "cid",
        redirectUri: "https://app/cb",
        code: "code",
        state: "wrong",
        storage,
        tokenStore: new OutlookTokenStore(memoryStorage()),
        fetchFn: (async () => jsonResponse({})) as unknown as typeof fetch,
      })
    ).rejects.toThrow(/state mismatch/);
  });

  it("rejects when verifier is missing", async () => {
    const storage = memoryStorage();
    storage.setItem("circular-time-outlook-pkce-state", "s");
    await expect(
      completeOutlookAuth({
        clientId: "cid",
        redirectUri: "https://app/cb",
        code: "code",
        state: "s",
        storage,
        tokenStore: new OutlookTokenStore(memoryStorage()),
        fetchFn: (async () => jsonResponse({})) as unknown as typeof fetch,
      })
    ).rejects.toThrow(/Missing PKCE verifier/);
  });
});
