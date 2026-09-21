import { describe, it, expect } from "vitest";
import { generateCodeVerifier, generateState, deriveCodeChallenge } from "./pkce";

describe("pkce", () => {
  it("generates a verifier within the RFC 7636 length bounds", () => {
    const v = generateCodeVerifier();
    expect(v.length).toBeGreaterThanOrEqual(43);
    expect(v.length).toBeLessThanOrEqual(128);
  });

  it("generates URL-safe verifiers (unreserved chars only)", () => {
    const v = generateCodeVerifier();
    expect(v).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it("generates distinct verifiers each call", () => {
    expect(generateCodeVerifier()).not.toBe(generateCodeVerifier());
  });

  it("generates distinct states each call", () => {
    expect(generateState()).not.toBe(generateState());
  });

  it("derives a base64url S256 challenge (no padding)", async () => {
    const challenge = await deriveCodeChallenge("test-verifier");
    expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(challenge).not.toContain("=");
  });

  it("derives the same challenge for the same verifier", async () => {
    const a = await deriveCodeChallenge("abc123");
    const b = await deriveCodeChallenge("abc123");
    expect(a).toBe(b);
  });

  it("matches a known SHA-256 PKCE test vector (RFC 7636 §A.2)", async () => {
    // verifier from the RFC appendix; expected challenge is its S256 transform.
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const challenge = await deriveCodeChallenge(verifier);
    expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});
