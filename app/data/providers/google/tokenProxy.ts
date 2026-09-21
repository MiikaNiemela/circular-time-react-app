/**
 * Server-side Google token-endpoint proxy.
 *
 * Google "Web application" OAuth clients are confidential: the token exchange
 * requires a `client_secret`, even when PKCE is used (see
 * https://developers.google.com/identity/protocols/oauth2/web-server). A
 * browser must never hold that secret, so the exchange/refresh is proxied
 * through this server-only module, which injects the credentials and forwards
 * the request to Google. PKCE's `code_verifier` is still passed through from
 * the browser as defense-in-depth.
 *
 * This runs only on the server (Cloud Run); the secret comes from a runtime
 * env var, not the client bundle.
 */

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

/** Params the browser is allowed to supply; everything else is ignored so the
 * client can never override the server-injected credentials. */
const FORWARDED_PARAMS = [
  "grant_type",
  "code",
  "code_verifier",
  "redirect_uri",
  "refresh_token",
] as const;

export interface TokenProxyEnv {
  clientId: string;
  clientSecret: string;
}

/**
 * Forwards a token request to Google with the server-held credentials added.
 * Returns Google's response verbatim (status + JSON body), or a 500 when the
 * server is not configured.
 */
export async function proxyGoogleToken(
  incoming: URLSearchParams,
  env: TokenProxyEnv,
  fetchFn: typeof fetch = fetch
): Promise<Response> {
  console.debug("Received request to proxy Google token endpoint");
  if (!env.clientId || !env.clientSecret) {
    console.error("Google credentials are not set on the server.");
    return Response.json(
      {
        error: "server_not_configured",
        error_description: "Google credentials are not set on the server.",
      },
      { status: 500 }
    );
  }

  const body = new URLSearchParams();
  for (const key of FORWARDED_PARAMS) {
    const value = incoming.get(key);
    if (value) body.set(key, value);
  }
  // Server-injected credentials win regardless of any client-supplied values.
  body.set("client_id", env.clientId);
  body.set("client_secret", env.clientSecret);
  console.debug("Forwarding token request to Google with injected credentials...");
  const res = await fetchFn(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const text = await res.text();
  console.debug(`Google token endpoint responded with status ${res.status}`);
  return new Response(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
