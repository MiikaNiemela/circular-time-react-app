/**
 * Authenticated encryption for provider OAuth tokens at rest.
 *
 * AES-256-GCM with a random 96-bit IV per message. Every ciphertext is bound
 * to a context string (the owning user and calendar connection) through
 * additional authenticated data, so a ciphertext copied into another row
 * fails to decrypt instead of granting that row's owner the tokens.
 *
 * The key is one application-scoped secret, TOKEN_ENCRYPTION_KEY: 32 bytes,
 * base64-encoded. It must be set in production; development uses a fixed
 * fallback so local runs work without Secret Manager.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const DEV_KEY = Buffer.alloc(32, "circular-time-dev-token-key").toString("base64");

export class TokenCipher {
  private constructor(private readonly key: Buffer) {}

  /** Builds a cipher from a base64-encoded 256-bit key. */
  static fromBase64(value: string): TokenCipher {
    const key = Buffer.from(value, "base64");
    if (key.length !== 32) {
      throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes, base64-encoded");
    }
    return new TokenCipher(key);
  }

  /** Encrypts `plaintext` bound to `context`; returns `v1.<iv>.<ciphertext+tag>`. */
  encrypt(plaintext: string, context: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(Buffer.from(context, "utf8"));
    const body = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
      cipher.getAuthTag(),
    ]);
    return [VERSION, iv.toString("base64url"), body.toString("base64url")].join(".");
  }

  /**
   * Decrypts a payload produced by {@link encrypt} for the same context.
   * Throws when the payload was tampered with, belongs to another context, or
   * was encrypted with a different key.
   */
  decrypt(payload: string, context: string): string {
    const [version, ivPart, bodyPart] = payload.split(".");
    if (version !== VERSION || !ivPart || !bodyPart) {
      throw new Error("Unsupported token ciphertext format");
    }
    const iv = Buffer.from(ivPart, "base64url");
    const body = Buffer.from(bodyPart, "base64url");
    if (iv.length !== IV_BYTES || body.length < TAG_BYTES) {
      throw new Error("Malformed token ciphertext");
    }
    const decipher = createDecipheriv("aes-256-gcm", this.key, iv);
    decipher.setAAD(Buffer.from(context, "utf8"));
    decipher.setAuthTag(body.subarray(body.length - TAG_BYTES));
    return Buffer.concat([
      decipher.update(body.subarray(0, body.length - TAG_BYTES)),
      decipher.final(),
    ]).toString("utf8");
  }
}

let cipher: TokenCipher | undefined;

/** The application's token cipher, built from TOKEN_ENCRYPTION_KEY on first use. */
export function tokenCipher(): TokenCipher {
  if (cipher) return cipher;
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key && process.env.NODE_ENV === "production") {
    throw new Error("TOKEN_ENCRYPTION_KEY must be set in production");
  }
  cipher = TokenCipher.fromBase64(key || DEV_KEY);
  return cipher;
}
