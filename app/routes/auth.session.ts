import type { Route } from "./+types/auth.session";
import { getSession, commitSession, destroySession } from "../lib/session.server";
import { fetchGoogleUserId, fetchOutlookUserId } from "../lib/userInfo.server";
import { userRepository } from "../lib/userRepository.server";

/**
 * Resource route (no default export): establishes an HTTP-only application
 * session after identity-only OAuth. Calendar connection is a separate intent.
 */
export async function action({ request }: Route.ActionArgs) {
  let body: { intent?: string; provider?: string; accessToken?: string };
  try {
    body = (await request.json()) as { intent?: string; provider?: string; accessToken?: string };
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { intent, provider, accessToken } = body;
  if (intent !== "sign-in") {
    return Response.json({ error: "Unknown OAuth intent" }, { status: 400 });
  }
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
    const result = await userRepository.signInWithProvider(provider, providerUserId);
    if (result.kind === "calendar-only") {
      return Response.json(
        { error: "Calendar-only identities cannot establish an application session" },
        { status: 403 }
      );
    }
    userId = result.userId;
  } catch {
    return Response.json({ error: "Failed to store user identity" }, { status: 503 });
  }

  // Always issue a new session: an existing one is revoked, never reused, so a
  // token known before sign-in cannot become authenticated (session fixation).
  const previous = await getSession(request.headers.get("Cookie"));
  if (previous.id) await destroySession(previous);
  const session = await getSession(null);
  session.set("userId", userId);

  return Response.json({ ok: true }, { headers: { "Set-Cookie": await commitSession(session) } });
}
