import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

const SECRET_NAME = "projects/683033464752/secrets/OAUTH_CLIENT_SECRET/versions/latest";

let cached: string | null = null;

/**
 * Fetches the Google OAuth client secret from GCP Secret Manager.
 * The Cloud Run service account must have the Secret Manager Secret Accessor role.
 * Result is cached in-process so each container only makes one RPC per cold start.
 */
export async function getGoogleClientSecret(): Promise<string> {
  if (cached) return cached;
  console.debug("Fetching Google client secret from Secret Manager...");
  const client = new SecretManagerServiceClient();
  const [version] = await client.accessSecretVersion({ name: SECRET_NAME });
  const payload = version.payload?.data;
  if (!payload) {
    console.error("Secret payload is empty");
    throw new Error("Secret payload is empty");
  }
  cached = Buffer.isBuffer(payload) ? payload.toString() : String(payload);
  console.debug("Google client secret fetched and cached");
  return cached;
}
