import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { completeGoogleAuth } from "../data/providers/google";
import { GOOGLE_CLIENT_ID, googleRedirectUri } from "../data/providers/google/config";
import { consumePostAuthRedirect } from "../lib/authState";

export function meta() {
  return [{ title: "Connecting Google Calendar…" }];
}

/**
 * OAuth callback for the Google PKCE flow. The code exchange must run in the
 * browser because the PKCE verifier lives in sessionStorage, so all work
 * happens in an effect — never during SSR.
 */
export default function GoogleCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = params.get("code");
    const state = params.get("state");
    const oauthError = params.get("error");
    console.debug("Running Google OAuth callback effect with params:", {
      code: code?.slice(-4),
      state: state?.slice(-4),
      error: oauthError,
    });

    if (oauthError) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(`Google denied the request: ${oauthError}`);
      return;
    }
    if (!code || !state) {
      setError("Missing authorization code in callback.");
      return;
    }

    const flow = consumePostAuthRedirect() ?? { intent: "connect-calendar", returnTo: "/settings" };

    completeGoogleAuth({
      clientId: GOOGLE_CLIENT_ID,
      redirectUri: googleRedirectUri(window.location.origin),
      code,
      state,
      persistTokens: flow.intent !== "sign-in",
    })
      .then(async (tokens) => {
        const response = await fetch("/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            intent: flow.intent,
            provider: "google",
            accessToken: tokens.accessToken,
          }),
        });
        if (!response.ok) {
          throw new Error("Unable to establish the application session.");
        }
        navigate(flow.returnTo, { replace: true });
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Sign-in failed."));
  }, [params, navigate]);

  return (
    <main style={{ padding: "2rem", textAlign: "center" }}>
      {error ? (
        <>
          <p>Could not connect Google Calendar.</p>
          <p>{error}</p>
          <a href="/settings">Back to settings</a>
        </>
      ) : (
        <p>Connecting Google Calendar…</p>
      )}
    </main>
  );
}
