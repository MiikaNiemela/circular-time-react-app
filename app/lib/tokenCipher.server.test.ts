import { describe, it, expect, vi, afterEach } from "vitest";
import { randomBytes } from "node:crypto";
import { TokenCipher } from "./tokenCipher.server";

const key = () => randomBytes(32).toString("base64");

describe("TokenCipher", () => {
  it("round-trips plaintext for the same context", () => {
    const cipher = TokenCipher.fromBase64(key());

    const payload = cipher.encrypt("secret-token", "user-a:connection-1");

    expect(payload).toMatch(/^v1\.[\w-]+\.[\w-]+$/);
    expect(payload).not.toContain("secret-token");
    expect(cipher.decrypt(payload, "user-a:connection-1")).toBe("secret-token");
  });

  it("uses a fresh IV, so equal plaintexts encrypt differently", () => {
    const cipher = TokenCipher.fromBase64(key());

    expect(cipher.encrypt("same", "ctx")).not.toBe(cipher.encrypt("same", "ctx"));
  });

  it("refuses a ciphertext moved to another user's context", () => {
    const cipher = TokenCipher.fromBase64(key());
    const payload = cipher.encrypt("secret-token", "user-a:connection-1");

    expect(() => cipher.decrypt(payload, "user-b:connection-1")).toThrow();
  });

  it("refuses a tampered ciphertext", () => {
    const cipher = TokenCipher.fromBase64(key());
    const [version, iv, body] = cipher.encrypt("secret-token", "ctx").split(".");
    const bytes = Buffer.from(body, "base64url");
    bytes[0] ^= 1;

    expect(() =>
      cipher.decrypt([version, iv, bytes.toString("base64url")].join("."), "ctx")
    ).toThrow();
  });

  it("refuses a ciphertext encrypted with a different key", () => {
    const payload = TokenCipher.fromBase64(key()).encrypt("secret-token", "ctx");

    expect(() => TokenCipher.fromBase64(key()).decrypt(payload, "ctx")).toThrow();
  });

  it("rejects keys that are not 256 bits", () => {
    expect(() => TokenCipher.fromBase64(randomBytes(16).toString("base64"))).toThrow(
      "TOKEN_ENCRYPTION_KEY must be 32 bytes, base64-encoded"
    );
  });

  it("rejects an unknown payload format", () => {
    expect(() => TokenCipher.fromBase64(key()).decrypt("v0.abc.def", "ctx")).toThrow(
      "Unsupported token ciphertext format"
    );
  });
});

describe("tokenCipher configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("requires TOKEN_ENCRYPTION_KEY in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", "");
    const { tokenCipher } = await import("./tokenCipher.server");

    expect(() => tokenCipher()).toThrow("TOKEN_ENCRYPTION_KEY must be set in production");
  });

  it("uses the configured key", async () => {
    const configured = key();
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", configured);
    const { tokenCipher } = await import("./tokenCipher.server");

    const payload = tokenCipher().encrypt("secret-token", "ctx");

    expect(TokenCipher.fromBase64(configured).decrypt(payload, "ctx")).toBe("secret-token");
  });
});
