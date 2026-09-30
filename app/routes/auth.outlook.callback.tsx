import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { completeOutlookAuth, OutlookTokenStore } from "../data/providers/outlook";
import { OUTLOOK_CLIENT_ID, outlookRedirectUri } from "../data/providers/outlook/config";
import { consumePostAuthRedirect } from "../lib/authState";
import { OAUTH_ENDPOINTS, responseError } from "../lib/oauthCompletion";

export function meta() {
  return [{ title: "Completing Outlook authorization…" }];
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

    const flow = consumePostAuthRedirect();
    if (!flow) {
      setError("OAuth flow state is missing. Start again from the sign-in or Settings page.");
      return;
    }
    if (flow.provider !== "outlook" || flow.oauthState !== state) {
      setError(
        "OAuth flow state does not match this callback. Start again from the sign-in or Settings page."
      );
      return;
    }

    completeOutlookAuth({
      clientId: OUTLOOK_CLIENT_ID,
      redirectUri: outlookRedirectUri(window.location.origin),
      code,
      state,
      persistTokens: false,
    })
      .then(async (tokens) => {
        const endpoint = OAUTH_ENDPOINTS[flow.intent];
        const body =
          flow.intent === "sign-in"
            ? { intent: flow.intent, provider: "outlook", accessToken: tokens.accessToken }
            : { provider: "outlook", accessToken: tokens.accessToken };
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          throw new Error(await responseError(response, flow.intent));
        }
        if (flow.intent === "connect-calendar") {
          const result: unknown = await response.json();
          const calendarConnectionId =
            typeof result === "object" && result !== null && "calendarConnectionId" in result
              ? (result as { calendarConnectionId?: unknown }).calendarConnectionId
              : null;
          if (typeof calendarConnectionId !== "string" || calendarConnectionId.length === 0) {
            throw new Error("Calendar connection was not confirmed.");
          }
          new OutlookTokenStore().set({ ...tokens, calendarConnectionId });
        }
        navigate(flow.returnTo, { replace: true });
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Sign-in failed."));
  }, [params, navigate]);

  return (
    <main style={{ padding: "2rem", textAlign: "center" }}>
      {error ? (
        <>
          <p>Outlook authorization did not complete.</p>
          <p>{error}</p>
          <a href="/settings">Back to settings</a>
        </>
      ) : (
        <p>Completing Outlook authorization…</p>
      )}
    </main>
  );
}
