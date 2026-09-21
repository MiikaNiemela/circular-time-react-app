/**
 * PKCE (Proof Key for Code Exchange, RFC 7636) helpers for the Google OAuth
 * Authorization Code flow without a client secret.
 *
 * PKCE lets a public client (browser SPA) prove it initiated the auth request
 * without embedding a secret: we send a hashed `code_challenge` up front, then
 * the original `code_verifier` when exchanging the code. This is why the app
 * needs only a public client ID, not a confidential secret.
 */

/** Base64url-encode bytes without padding (RFC 7636 §A). */
function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Cryptographically-random URL-safe string of `length` chars. */
function randomString(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes).slice(0, length);
}

/**
 * Generates a high-entropy code verifier (RFC 7636 requires 43–128 chars from
 * the unreserved set). We use 64 url-safe characters.
 */
export function generateCodeVerifier(): string {
  return randomString(64);
}

/** Opaque value echoed back on the callback to defend against CSRF. */
export function generateState(): string {
  return randomString(32);
}

/**
 * Derives the S256 code challenge: base64url(SHA-256(verifier)).
 * Google supports the `S256` method, which we always use (never `plain`).
 */
export async function deriveCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}
