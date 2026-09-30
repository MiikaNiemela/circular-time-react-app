import type { Route } from "./+types/auth.sign-out";
import { getSession, destroySession } from "../lib/session.server";

/** Clears the HTTP-only application session without disconnecting calendars. */
export async function action({ request }: Route.ActionArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  return new Response(null, {
    status: 204,
    headers: { "Set-Cookie": await destroySession(session) },
  });
}
