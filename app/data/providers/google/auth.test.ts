import { describe, it, expect } from "vitest";
import { buildAuthUrl, CALENDAR_SCOPE } from "./auth";

describe("buildAuthUrl", () => {
  it("includes all required PKCE + OAuth params", () => {
    const url = new URL(
      buildAuthUrl({
        clientId: "cid",
        redirectUri: "https://app/cb",
        codeChallenge: "chal",
        state: "st",
      })
    );
    const p = url.searchParams;
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(p.get("client_id")).toBe("cid");
    expect(p.get("redirect_uri")).toBe("https://app/cb");
    expect(p.get("response_type")).toBe("code");
    expect(p.get("code_challenge")).toBe("chal");
    expect(p.get("code_challenge_method")).toBe("S256");
    expect(p.get("state")).toBe("st");
    expect(p.get("scope")).toBe(CALENDAR_SCOPE);
    expect(p.get("access_type")).toBe("offline");
  });

  it("honours a custom scope", () => {
    const url = new URL(
      buildAuthUrl({
        clientId: "c",
        redirectUri: "r",
        codeChallenge: "c2",
        state: "s",
        scope: "custom",
      })
    );
    expect(url.searchParams.get("scope")).toBe("custom");
  });
});
