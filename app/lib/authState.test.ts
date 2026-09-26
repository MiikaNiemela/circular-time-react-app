import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setPostAuthRedirect, consumePostAuthRedirect } from "./authState";

const FLOW_KEY = "circular-time-post-auth-redirect";

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  sessionStorage.clear();
});

describe("OAuth flow state", () => {
  it("records an identity-only sign-in flow and consumes it once", () => {
    const flow = { intent: "sign-in" as const, returnTo: "/" };

    setPostAuthRedirect(flow);

    expect(sessionStorage.getItem(FLOW_KEY)).toBe(JSON.stringify(flow));
    expect(consumePostAuthRedirect()).toEqual(flow);
    expect(sessionStorage.getItem(FLOW_KEY)).toBeNull();
  });

  it("returns null when no OAuth flow is pending", () => {
    expect(consumePostAuthRedirect()).toBeNull();
  });

  it("rejects malformed pending OAuth flow state", () => {
    sessionStorage.setItem(FLOW_KEY, "not-json");

    expect(consumePostAuthRedirect()).toBeNull();
    expect(sessionStorage.getItem(FLOW_KEY)).toBeNull();
  });
});
