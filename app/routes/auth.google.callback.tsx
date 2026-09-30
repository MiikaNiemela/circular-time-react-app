import { useLoaderData } from "react-router";
import type { Route } from "./+types/auth.google.callback";

export function meta() {
  return [{ title: "Completing Google authorization…" }];
}

/**
 * OAuth redirect target for Google. The server redeems the code, completes the
 * flow's intent, and redirects; only a failure renders this page.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const { completeOAuthFlow } = await import("../lib/oauthFlow.server");
  return completeOAuthFlow(request, "google");
}

export default function GoogleCallback() {
  const { error } = useLoaderData<typeof loader>();
  return (
    <main style={{ padding: "2rem", textAlign: "center" }}>
      <p>Google authorization did not complete.</p>
      <p>{error}</p>
      <a href="/settings">Back to settings</a>
    </main>
  );
}
