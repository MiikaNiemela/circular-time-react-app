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

    completeOutlookAuth({
      clientId: OUTLOOK_CLIENT_ID,
      redirectUri: outlookRedirectUri(window.location.origin),
      code,
      state,
    })
      .then(async (tokens) => {
        // Non-blocking: localStorage auth remains active if session creation fails.
        await fetch("/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: "outlook", accessToken: tokens.accessToken }),
        }).catch(console.error);
        navigate(consumePostAuthRedirect() ?? "/settings", { replace: true });
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
