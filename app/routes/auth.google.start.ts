import type { Route } from "./+types/auth.google.start";

/**
 * Resource route: starts a Google OAuth flow on the server from a same-origin
 * form post with an `intent` field, and redirects to Google.
 */
export async function action({ request }: Route.ActionArgs) {
  const { startOAuthFlow } = await import("../lib/oauthFlow.server");
  return startOAuthFlow(request, "google");
}
