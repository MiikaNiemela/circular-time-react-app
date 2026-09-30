import type { Route } from "./+types/auth.calendar-disconnection";
import { getUserId } from "../lib/session.server";
import { userRepository } from "../lib/userRepository.server";

/**
 * Authenticated resource route that removes one provider's calendar access from
 * the current application account. The provider identity remains linked so it
 * can still establish a future application session.
 */
export async function action({ request }: Route.ActionArgs) {
  const userId = await getUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { provider?: string };
  try {
    body = (await request.json()) as { provider?: string };
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { provider } = body;
  if (provider !== "google" && provider !== "outlook") {
    return Response.json({ error: "Unknown provider" }, { status: 400 });
  }

  try {
    await userRepository.disconnectCalendarProvider(userId, provider);
  } catch {
    return Response.json({ error: "Failed to remove calendar connection" }, { status: 503 });
  }

  return Response.json({ ok: true });
}
