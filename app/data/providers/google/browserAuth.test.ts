import { describe, it, expect, vi } from "vitest";
import { startGoogleAuth, completeGoogleAuth } from "./browserAuth";
import { GoogleTokenStore } from "./tokenStore";
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

describe("startGoogleAuth", () => {
  it("stashes verifier+state and returns an auth URL bound to them", async () => {
    const storage = memoryStorage();
    const url = new URL(
      await startGoogleAuth({
        clientId: "cid",
        redirectUri: "https://app/cb",
        storage,
      })
    );

    const state = url.searchParams.get("state");
    expect(state).toBeTruthy();
    expect(storage.getItem("circular-time-google-pkce-state")).toBe(state);
    expect(storage.getItem("circular-time-google-pkce-verifier")).toBeTruthy();
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
  });
  it("uses the requested scope for an identity-only sign-in", async () => {
    const storage = memoryStorage();
    const url = new URL(
      await startGoogleAuth({
        clientId: "cid",
        redirectUri: "https://app/cb",
        scope: "openid email profile",
        storage,
      })
    );

    expect(url.searchParams.get("scope")).toBe("openid email profile");
  });
});

describe("completeGoogleAuth", () => {
  it("validates state, exchanges the code, stores tokens, clears secrets", async () => {
    const storage = memoryStorage();
    // Simulate a prior startGoogleAuth.
    await startGoogleAuth({ clientId: "cid", redirectUri: "https://app/cb", storage });
    const state = storage.getItem("circular-time-google-pkce-state")!;

    const fetchFn = vi.fn(async () =>
      jsonResponse({
        access_token: "at",
        refresh_token: "rt",
        expires_in: 3600,
        token_type: "Bearer",
      })
    );
    const tokenStore = new GoogleTokenStore(memoryStorage());

    const tokens = await completeGoogleAuth({
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
    // One-time secrets cleared.
    expect(storage.getItem("circular-time-google-pkce-state")).toBeNull();
    expect(storage.getItem("circular-time-google-pkce-verifier")).toBeNull();
  });

  it("does not persist calendar tokens for an identity-only sign-in", async () => {
    const storage = memoryStorage();
    await startGoogleAuth({ clientId: "cid", redirectUri: "https://app/cb", storage });
    const state = storage.getItem("circular-time-google-pkce-state")!;
    const tokenStore = new GoogleTokenStore(memoryStorage());

    await completeGoogleAuth({
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

  it("rejects a mismatched state (CSRF defence)", async () => {
    const storage = memoryStorage();
    await startGoogleAuth({ clientId: "cid", redirectUri: "https://app/cb", storage });

    await expect(
      completeGoogleAuth({
        clientId: "cid",
        redirectUri: "https://app/cb",
        code: "authcode",
        state: "not-the-real-state",
        storage,
        tokenStore: new GoogleTokenStore(memoryStorage()),
        fetchFn: (async () => jsonResponse({})) as unknown as typeof fetch,
      })
    ).rejects.toThrow(/state mismatch/);
  });

  it("rejects when the verifier is missing", async () => {
    const storage = memoryStorage();
    // Only a state present, no verifier.
    storage.setItem("circular-time-google-pkce-state", "s");

    await expect(
      completeGoogleAuth({
        clientId: "cid",
        redirectUri: "https://app/cb",
        code: "authcode",
        state: "s",
        storage,
        tokenStore: new GoogleTokenStore(memoryStorage()),
        fetchFn: (async () => jsonResponse({})) as unknown as typeof fetch,
      })
    ).rejects.toThrow(/Missing PKCE verifier/);
  });
});
