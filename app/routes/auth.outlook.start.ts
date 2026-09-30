import type { Route } from "./+types/auth.outlook.start";

/**
 * Resource route: starts a Microsoft OAuth flow on the server from a same-origin
 * form post with an `intent` field, and redirects to Microsoft.
 */
export async function action({ request }: Route.ActionArgs) {
  const { startOAuthFlow } = await import("../lib/oauthFlow.server");
  return startOAuthFlow(request, "outlook");
}
