import { describe, it, expect } from "vitest";
import { buildAuthUrl, CALENDAR_SCOPE } from "./auth";

describe("buildAuthUrl", () => {
  it("includes all required PKCE + OAuth params for Microsoft", () => {
    const url = new URL(
      buildAuthUrl({
        clientId: "cid",
        redirectUri: "https://app/cb",
        codeChallenge: "chal",
        state: "st",
      })
    );
    const p = url.searchParams;
    expect(url.hostname).toBe("login.microsoftonline.com");
    expect(p.get("client_id")).toBe("cid");
    expect(p.get("code_challenge_method")).toBe("S256");
    expect(p.get("state")).toBe("st");
    expect(p.get("response_mode")).toBe("query");
    expect(p.get("scope")).toBe(CALENDAR_SCOPE);
  });
});
