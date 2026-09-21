import type { Route } from "./+types/auth.google.token";
import { proxyGoogleToken } from "../data/providers/google/tokenProxy";
import { getGoogleClientSecret } from "../data/providers/google/secretManager.server";

/**
 * Resource route (no default export): same-origin proxy for the Google token
 * endpoint. The browser POSTs the PKCE exchange/refresh here; the server adds
 * the confidential client credentials fetched from GCP Secret Manager and
 * forwards to Google.
 */
export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const incoming = new URLSearchParams();
  console.debug("Received request to /auth/google/token with form data.");
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") incoming.set(key, value);
  }

  const clientSecret = await getGoogleClientSecret();

  return proxyGoogleToken(incoming, {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret,
  });
}
