import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useIsAuthenticated, setPostAuthRedirect, consumePostAuthRedirect } from "./authState";

const GOOGLE_KEY = "circular-time-google-tokens";
const OUTLOOK_KEY = "circular-time-outlook-tokens";

function makeTokens() {
  return JSON.stringify({ accessToken: "tok", expiresAt: Date.now() + 3_600_000 });
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("useIsAuthenticated", () => {
  it("returns false when localStorage is empty", () => {
    const { result } = renderHook(() => useIsAuthenticated());
    expect(result.current).toBe(false);
  });

  it("returns true when Google tokens are present", () => {
    localStorage.setItem(GOOGLE_KEY, makeTokens());
    const { result } = renderHook(() => useIsAuthenticated());
    expect(result.current).toBe(true);
  });

  it("returns true when Outlook tokens are present", () => {
    localStorage.setItem(OUTLOOK_KEY, makeTokens());
    const { result } = renderHook(() => useIsAuthenticated());
    expect(result.current).toBe(true);
  });

  it("returns true when both providers have tokens", () => {
    localStorage.setItem(GOOGLE_KEY, makeTokens());
    localStorage.setItem(OUTLOOK_KEY, makeTokens());
    const { result } = renderHook(() => useIsAuthenticated());
    expect(result.current).toBe(true);
  });
});

describe("setPostAuthRedirect / consumePostAuthRedirect", () => {
  it("stores a URL and consumePostAuthRedirect reads and clears it", () => {
    setPostAuthRedirect("/");
    expect(sessionStorage.getItem("circular-time-post-auth-redirect")).toBe("/");
    expect(consumePostAuthRedirect()).toBe("/");
    expect(sessionStorage.getItem("circular-time-post-auth-redirect")).toBeNull();
  });

  it("consumePostAuthRedirect returns null when no redirect was stored", () => {
    expect(consumePostAuthRedirect()).toBeNull();
  });

  it("each call to consumePostAuthRedirect returns null after the first read", () => {
    setPostAuthRedirect("/settings");
    consumePostAuthRedirect();
    expect(consumePostAuthRedirect()).toBeNull();
  });
});
