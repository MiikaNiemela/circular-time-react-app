import type { Route } from "./+types/auth.sign-out";
import { redirect } from "react-router";
import { getSession, destroySession } from "../lib/session.server";

/**
 * Clears the HTTP-only application session and returns to sign-in. Calendar
 * connections and linked identities are unchanged, so signing in again resumes
 * the same account. The 303 lets a plain HTML form POST land on the sign-in page.
 */
export async function action({ request }: Route.ActionArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  return redirect("/sign-in", {
    status: 303,
    headers: { "Set-Cookie": await destroySession(session) },
  });
}
