import type { Route } from "./+types/sign-in";
import { redirect } from "react-router";
import { startGoogleSignIn, startOutlookSignIn } from "../lib/providerAuth";
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
  async function signInWithGoogle() {
    const url = await startGoogleSignIn({ returnTo: "/" });
    if (!url) {
      alert("Google Calendar is not configured for this build.");
      return;
    }
    window.location.assign(url);
  }

  async function signInWithOutlook() {
    const url = await startOutlookSignIn({ returnTo: "/" });
    if (!url) {
      alert("Outlook Calendar is not configured for this build.");
      return;
    }
    window.location.assign(url);
  }

  return (
    <main className={page}>
      <div className={card}>
        <h1 className={heading}>Circular Time</h1>
        <p className={subtitle}>
          Sign in with your calendar provider to view your events as a circular timeline.
        </p>
        <div className={buttons}>
          <button type="button" className={providerButton} onClick={signInWithGoogle}>
            Sign in with Google
          </button>
          <button type="button" className={providerButton} onClick={signInWithOutlook}>
            Sign in with Outlook
          </button>
        </div>
      </div>
    </main>
  );
}
