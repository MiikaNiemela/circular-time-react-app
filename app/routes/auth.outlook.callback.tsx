import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { completeOutlookAuth } from "../data/providers/outlook";
import { OUTLOOK_CLIENT_ID, outlookRedirectUri } from "../data/providers/outlook/config";
import { consumePostAuthRedirect } from "../lib/authState";

export function meta() {
  return [{ title: "Connecting Outlook…" }];
}

export default function OutlookCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = params.get("code");
    const state = params.get("state");
    const oauthError = params.get("error");

    if (oauthError) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(`Microsoft denied the request: ${oauthError}`);
      return;
    }
    if (!code || !state) {
      setError("Missing authorization code in callback.");
      return;
    }

    const flow = consumePostAuthRedirect() ?? { intent: "connect-calendar", returnTo: "/settings" };

    completeOutlookAuth({
      clientId: OUTLOOK_CLIENT_ID,
      redirectUri: outlookRedirectUri(window.location.origin),
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
            provider: "outlook",
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
          <p>Could not connect Outlook Calendar.</p>
          <p>{error}</p>
          <a href="/settings">Back to settings</a>
        </>
      ) : (
        <p>Connecting Outlook Calendar…</p>
      )}
    </main>
  );
}
