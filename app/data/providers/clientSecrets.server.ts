/**
 * Reads OAuth client secrets from GCP Secret Manager.
 *
 * Each secret is addressed by a runtime resource name (never the value), and
 * the Cloud Run service account holds the Secret Accessor role on it. Values
 * are cached in-process, so each container makes one RPC per secret.
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

function readSecret(resource: string | undefined, variable: string): Promise<string> {
  if (!resource) return Promise.reject(new Error(`${variable} is not configured`));
  let value = cache.get(resource);
  if (!value) {
    value = accessSecret(resource);
    // A failed read is not cached, so a transient error is retried next time.
    value.catch(() => cache.delete(resource));
    cache.set(resource, value);
  }
  return value;
}

/** The Google OAuth client secret. */
export function getGoogleClientSecret(): Promise<string> {
  return readSecret(process.env.GOOGLE_CLIENT_SECRET_RESOURCE, "GOOGLE_CLIENT_SECRET_RESOURCE");
}

/** The Microsoft (Outlook) OAuth client secret. */
export function getOutlookClientSecret(): Promise<string> {
  return readSecret(process.env.OUTLOOK_CLIENT_SECRET_RESOURCE, "OUTLOOK_CLIENT_SECRET_RESOURCE");
}
