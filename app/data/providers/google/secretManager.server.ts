import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

const secretName = process.env.GOOGLE_CLIENT_SECRET_RESOURCE;

let cached: string | null = null;

/**
 * Fetches the Google OAuth client secret from GCP Secret Manager.
 * The Cloud Run service account must have the Secret Manager Secret Accessor role.
 * Result is cached in-process so each container only makes one RPC per cold start.
 */
export async function getGoogleClientSecret(): Promise<string> {
  if (cached) return cached;
  if (!secretName) {
    throw new Error("GOOGLE_CLIENT_SECRET_RESOURCE is not configured");
  }
  console.debug("Fetching Google client secret from Secret Manager...");
  const client = new SecretManagerServiceClient();
  const [version] = await client.accessSecretVersion({ name: secretName });
  const payload = version.payload?.data;
  if (!payload) {
    console.error("Secret payload is empty");
    throw new Error("Secret payload is empty");
  }
  cached = Buffer.isBuffer(payload) ? payload.toString() : String(payload);
  console.debug("Google client secret fetched and cached");
  return cached;
}
