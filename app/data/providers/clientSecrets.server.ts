/**
 * Reads the OAuth client secrets at runtime.
 *
 * Each secret is supplied in one of two ways:
 * - `*_CLIENT_SECRET`: the value itself, for local development and for any
 *   container runtime that injects secrets as environment variables.
 * - `*_CLIENT_SECRET_RESOURCE`: a Google Secret Manager version resource name
 *   (never the value), read with the runtime identity's credentials and cached
 *   in-process, so each container makes one RPC per secret.
 *
 * When both are set, the value is used.
 */
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

const cache = new Map<string, Promise<string>>();

async function accessSecret(resource: string): Promise<string> {
  const client = new SecretManagerServiceClient();
  const [version] = await client.accessSecretVersion({ name: resource });
  const payload = version.payload?.data;
  if (!payload) throw new Error("Secret payload is empty");
  return Buffer.isBuffer(payload) ? payload.toString() : String(payload);
}

function readSecret(prefix: "GOOGLE" | "OUTLOOK"): Promise<string> {
  const value = process.env[`${prefix}_CLIENT_SECRET`];
  if (value) return Promise.resolve(value);
  const resource = process.env[`${prefix}_CLIENT_SECRET_RESOURCE`];
  if (!resource) {
    return Promise.reject(
      new Error(`${prefix}_CLIENT_SECRET or ${prefix}_CLIENT_SECRET_RESOURCE is not configured`)
    );
  }
  let cached = cache.get(resource);
  if (!cached) {
    cached = accessSecret(resource);
    // A failed read is not cached, so a transient error is retried next time.
    cached.catch(() => cache.delete(resource));
    cache.set(resource, cached);
  }
  return cached;
}

/** The Google OAuth client secret. */
export function getGoogleClientSecret(): Promise<string> {
  return readSecret("GOOGLE");
}

/** The Microsoft (Outlook) OAuth client secret. */
export function getOutlookClientSecret(): Promise<string> {
  return readSecret("OUTLOOK");
}
