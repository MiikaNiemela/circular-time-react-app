import type { Route } from "./+types/sign-in";
import { redirect } from "react-router";
import { page, card, heading, subtitle, buttons, providerButton } from "./sign-in.css";

export function meta() {
  return [{ title: "Sign in — Circular Time" }];
}

/** Keeps an established application session out of the sign-in screen. */
export async function loader({ request }: Route.LoaderArgs) {
  const { getUserId } = await import("../lib/session.server");
  if (await getUserId(request)) throw redirect("/");
  return null;
}

export default function SignIn() {
  return (
    <main className={page}>
      <div className={card}>
        <h1 className={heading}>Circular Time</h1>
        <p className={subtitle}>
          Sign in to use Circular Time. Connect a calendar separately in Settings to read events.
        </p>
        <div className={buttons}>
          <form method="post" action="/auth/google/start">
            <input type="hidden" name="intent" value="sign-in" />
            <button type="submit" className={providerButton}>
              Sign in with Google
            </button>
          </form>
          <form method="post" action="/auth/outlook/start">
            <input type="hidden" name="intent" value="sign-in" />
            <button type="submit" className={providerButton}>
              Sign in with Outlook
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
