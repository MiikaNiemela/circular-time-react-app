import { useLoaderData } from "react-router";
import type { Route } from "./+types/auth.outlook.callback";

export function meta() {
  return [{ title: "Completing Microsoft authorization…" }];
}

/**
 * OAuth redirect target for Microsoft. The server redeems the code, completes the
 * flow's intent, and redirects; only a failure renders this page.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const { completeOAuthFlow } = await import("../lib/oauthFlow.server");
  const result = await completeOAuthFlow(request, "outlook");
  if (result instanceof Response) return result;
  return result;
}

export default function OutlookCallback() {
  const { error } = useLoaderData<typeof loader>();
  return (
    <main style={{ padding: "2rem", textAlign: "center" }}>
      <p>Microsoft authorization did not complete.</p>
      <p>{error}</p>
      <a href="/settings">Back to settings</a>
    </main>
  );
}
