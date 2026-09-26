import type { Route } from "./+types/auth.calendar-connection";
import { getUserId } from "../lib/session.server";
import { fetchGoogleUserId, fetchOutlookUserId } from "../lib/userInfo.server";
import { userRepository } from "../lib/userRepository.server";

/**
 * Authenticated resource route that binds verified provider calendar access to
 * the existing application account. It never creates a session or merges
 * accounts, so calendar consent cannot change the account identity.
 */
export async function action({ request }: Route.ActionArgs) {
  const userId = await getUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  try {
    const result = await userRepository.connectCalendarProvider(userId, provider, providerUserId);
    if (result === "conflict") {
      return Response.json(
        { error: "Calendar identity belongs to another application account" },
        { status: 409 }
      );
    }
  } catch {
    return Response.json({ error: "Failed to store calendar connection" }, { status: 503 });
  }

  return Response.json({ ok: true });
}
