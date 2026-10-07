import type { Route } from "./+types/auth.calendar-disconnection";
import { getUserId } from "../lib/session.server";
import { userRepository } from "../lib/userRepository.server";
import { readProviderBody } from "../lib/providerRequest.server";
import { rejectUnsafeRequest } from "../lib/sameOrigin.server";

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
  const unsafe = rejectUnsafeRequest(request, { json: true });
  if (unsafe) return unsafe;

  const provider = await readProviderBody(request);
  if (provider instanceof Response) return provider;

  try {
    await userRepository.disconnectCalendarProvider(userId, provider);
  } catch {
    return Response.json({ error: "Failed to remove calendar connection" }, { status: 503 });
  }

  return Response.json({ ok: true });
}
