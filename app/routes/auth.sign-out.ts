import type { Route } from "./+types/auth.sign-out";
import { redirect } from "react-router";
import { getSession, destroySession } from "../lib/session.server";

/**
 * Revokes the application session on the server, clears its cookie, and
 * returns to sign-in. A copy of the cookie no longer authenticates. Only the
 * session is removed: the account, linked identities, calendar connections,
 * and cached events are unchanged, so signing in again resumes the same
 * account. The 303 lets a plain HTML form POST land on the sign-in page.
 */
export async function action({ request }: Route.ActionArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  return redirect("/sign-in", {
    status: 303,
    headers: { "Set-Cookie": await destroySession(session) },
  });
}
