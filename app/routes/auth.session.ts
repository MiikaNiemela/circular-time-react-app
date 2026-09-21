import type { Route } from "./+types/auth.session";
import { getSession, commitSession } from "../lib/session.server";
import { fetchGoogleUserId, fetchOutlookUserId } from "../lib/userInfo.server";
import { userRepository } from "../lib/userRepository.server";

/**
 * Resource route (no default export): creates an HTTP-only signed session cookie
 * after a successful client-side OAuth exchange.
 *
 * The client POSTs { provider, accessToken } immediately after storing tokens in
 * localStorage; the server verifies the token with the provider, upserts the user
 * record in the database, and sets the session cookie containing the stable user ID.
 */
export async function action({ request }: Route.ActionArgs) {
  let body: { provider?: string; accessToken?: string };
  try {
    body = (await request.json()) as { provider?: string; accessToken?: string };
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { provider, accessToken } = body;
  if (!provider || !accessToken) {
    return Response.json({ error: "Missing provider or accessToken" }, { status: 400 });
  }

  let providerUserId: string;
  try {
    if (provider === "google") {
      providerUserId = await fetchGoogleUserId(accessToken);
    } else if (provider === "outlook") {
      providerUserId = await fetchOutlookUserId(accessToken);
    } else {
      return Response.json({ error: "Unknown provider" }, { status: 400 });
    }
  } catch {
    return Response.json({ error: "Failed to verify identity with provider" }, { status: 401 });
  }

  let userId: string;
  try {
    userId = await userRepository.upsertUser(provider, providerUserId);
  } catch {
    return Response.json({ error: "Failed to store user identity" }, { status: 503 });
  }

  const session = await getSession(request.headers.get("Cookie"));
  session.set("userId", userId);

  return Response.json({ ok: true }, { headers: { "Set-Cookie": await commitSession(session) } });
}
