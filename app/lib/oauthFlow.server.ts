/**
 * Server-side OAuth 2.0 authorization-code flow (with PKCE) for Google and
 * Microsoft, covering the three intents: sign in, link a sign-in identity to
 * the current account, and connect a calendar.
 *
 * The server generates the PKCE verifier and state, keeps them in a signed,
 * HTTP-only, ten-minute cookie scoped to /auth, redeems the code with the
 * confidential client secret, and completes the intent. Provider tokens stay
 * on the server; calendar credentials are stored encrypted.
 */
import { createCookie, redirect } from "react-router";
import {
  deriveCodeChallenge,
  generateCodeVerifier,
  generateState,
} from "../data/providers/google/pkce";
import {
  buildAuthUrl as buildGoogleAuthUrl,
  CALENDAR_CONNECTION_SCOPE as GOOGLE_CALENDAR_CONNECTION_SCOPE,
  IDENTITY_SCOPE as GOOGLE_IDENTITY_SCOPE,
} from "../data/providers/google/auth";
import {
  buildAuthUrl as buildOutlookAuthUrl,
  CALENDAR_CONNECTION_SCOPE as OUTLOOK_CALENDAR_CONNECTION_SCOPE,
  IDENTITY_SCOPE as OUTLOOK_IDENTITY_SCOPE,
} from "../data/providers/outlook/auth";
import { GOOGLE_CLIENT_ID } from "../data/providers/google/config";
import { OUTLOOK_CLIENT_ID } from "../data/providers/outlook/config";
import {
  exchangeAuthorizationCode,
  type OAuthClientCredentials,
  type OAuthProviderId,
  type ProviderTokens,
} from "../data/providers/oauthClient.server";
import {
  getGoogleClientSecret,
  getOutlookClientSecret,
} from "../data/providers/clientSecrets.server";
import {
  fetchGoogleUserId,
  fetchOutlookUserId,
  verifyGoogleCalendarAccess,
  verifyOutlookCalendarAccess,
} from "./userInfo.server";
import { commitSession, destroySession, getSession, getUserId } from "./session.server";
import { userRepository } from "./userRepository.server";
import { calendarCredentialStore } from "./calendarCredentials.server";

export type OAuthIntent = "sign-in" | "link-identity" | "connect-calendar";

const INTENTS: readonly OAuthIntent[] = ["sign-in", "link-identity", "connect-calendar"];
const PROVIDERS: readonly OAuthProviderId[] = ["google", "outlook"];

/** Where each intent returns after completion; fixed, so there is no open redirect. */
const RETURN_TO: Record<OAuthIntent, string> = {
  "sign-in": "/",
  "link-identity": "/settings",
  "connect-calendar": "/settings",
};

/** Flow state kept in the signed cookie between the start and the callback. */
interface PendingFlow {
  provider: OAuthProviderId;
  intent: OAuthIntent;
  state: string;
  codeVerifier: string;
  redirectUri: string;
  /** The account that started a link or connect flow; it must still be signed in. */
  userId: string | null;
}

/** A failed completion, rendered by the callback page. */
export interface OAuthFailure {
  error: string;
}

/** Whether a route parameter names a supported OAuth provider. */
export function isOAuthProvider(value: unknown): value is OAuthProviderId {
  return PROVIDERS.includes(value as OAuthProviderId);
}

function isIntent(value: unknown): value is OAuthIntent {
  return INTENTS.includes(value as OAuthIntent);
}

const flowCookie = createCookie("__oauth_flow", {
  httpOnly: true,
  sameSite: "lax",
  path: "/auth",
  maxAge: 600,
  secure: process.env.NODE_ENV === "production",
  secrets: [process.env.SESSION_SECRET ?? "dev-secret-change-in-production"],
});

function isPendingFlow(value: unknown): value is PendingFlow {
  if (!value || typeof value !== "object") return false;
  const flow = value as Record<string, unknown>;
  return (
    isOAuthProvider(flow.provider) &&
    isIntent(flow.intent) &&
    typeof flow.state === "string" &&
    flow.state.length > 0 &&
    typeof flow.codeVerifier === "string" &&
    typeof flow.redirectUri === "string" &&
    (flow.userId === null || typeof flow.userId === "string")
  );
}

/**
 * The public origin for redirect URIs. Cloud Run terminates TLS in front of
 * the container, so production requests arrive as http; providers require the
 * exact registered https URI. Loopback hosts keep http for local runs.
 */
export function publicOrigin(request: Request): string {
  const url = new URL(request.url);
  const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (process.env.NODE_ENV === "production" && !loopback) url.protocol = "https:";
  return url.origin;
}

/** Rejects cross-origin form posts that try to start a flow for the user. */
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("Origin");
  if (!origin || origin === "null") return origin === null;
  return new URL(origin).host === new URL(request.url).host;
}

const SCOPES: Record<OAuthProviderId, Record<OAuthIntent, string>> = {
  google: {
    "sign-in": GOOGLE_IDENTITY_SCOPE,
    "link-identity": GOOGLE_IDENTITY_SCOPE,
    "connect-calendar": GOOGLE_CALENDAR_CONNECTION_SCOPE,
  },
  outlook: {
    "sign-in": OUTLOOK_IDENTITY_SCOPE,
    "link-identity": OUTLOOK_IDENTITY_SCOPE,
    "connect-calendar": OUTLOOK_CALENDAR_CONNECTION_SCOPE,
  },
};

const CLIENT_IDS: Record<OAuthProviderId, string> = {
  google: GOOGLE_CLIENT_ID,
  outlook: OUTLOOK_CLIENT_ID,
};

/**
 * Starts a flow from a same-origin form post and redirects the browser to the
 * provider. Link and connect flows require a signed-in application account.
 */
export async function startOAuthFlow(
  request: Request,
  provider: OAuthProviderId
): Promise<Response> {
  if (!isSameOrigin(request)) {
    return new Response("Cross-origin request refused", { status: 403 });
  }
  const form = await request.formData();
  const intent = form.get("intent");
  if (!isIntent(intent)) {
    return new Response("Unknown OAuth intent", { status: 400 });
  }
  const clientId = CLIENT_IDS[provider];
  if (!clientId) {
    return new Response(`${provider} sign-in is not configured`, { status: 503 });
  }
  const userId = await getUserId(request);
  if (intent !== "sign-in" && !userId) {
    throw redirect("/sign-in");
  }

  const codeVerifier = generateCodeVerifier();
  const state = generateState();
  const redirectUri = `${publicOrigin(request)}/auth/${provider}/callback`;
  const params = {
    clientId,
    redirectUri,
    codeChallenge: await deriveCodeChallenge(codeVerifier),
    state,
    scope: SCOPES[provider][intent],
  };
  const url = provider === "google" ? buildGoogleAuthUrl(params) : buildOutlookAuthUrl(params);
  const flow: PendingFlow = {
    provider,
    intent,
    state,
    codeVerifier,
    redirectUri,
    userId: intent === "sign-in" ? null : userId,
  };
  return redirect(url, { headers: { "Set-Cookie": await flowCookie.serialize(flow) } });
}

async function clientCredentials(provider: OAuthProviderId): Promise<OAuthClientCredentials> {
  const clientSecret =
    provider === "google" ? await getGoogleClientSecret() : await getOutlookClientSecret();
  return { clientId: CLIENT_IDS[provider], clientSecret };
}

function fetchProviderUserId(provider: OAuthProviderId, accessToken: string): Promise<string> {
  return provider === "google" ? fetchGoogleUserId(accessToken) : fetchOutlookUserId(accessToken);
}

function verifyCalendarAccess(provider: OAuthProviderId, accessToken: string): Promise<void> {
  return provider === "google"
    ? verifyGoogleCalendarAccess(accessToken)
    : verifyOutlookCalendarAccess(accessToken);
}

class FlowError extends Error {}

/** Signs in, always issuing a new session so a pre-existing token cannot be fixed. */
async function completeSignIn(
  request: Request,
  provider: OAuthProviderId,
  providerUserId: string,
  headers: Headers
): Promise<void> {
  const result = await userRepository.signInWithProvider(provider, providerUserId);
  if (result.kind === "calendar-only") {
    throw new FlowError(
      "This account is connected only as a calendar. Sign in with a linked account instead."
    );
  }
  const previous = await getSession(request.headers.get("Cookie"));
  if (previous.id) await destroySession(previous);
  const session = await getSession(null);
  session.set("userId", result.userId);
  headers.append("Set-Cookie", await commitSession(session));
}

async function completeLink(
  userId: string,
  provider: OAuthProviderId,
  providerUserId: string
): Promise<void> {
  const result = await userRepository.linkProviderAccount(userId, provider, providerUserId);
  if (result === "conflict") {
    throw new FlowError(
      "This account already belongs to another Circular Time account. Accounts are never merged."
    );
  }
  if (result === "provider-already-linked") {
    throw new FlowError("A different account from this provider is already linked.");
  }
}

async function completeCalendarConnection(
  userId: string,
  provider: OAuthProviderId,
  providerUserId: string,
  tokens: ProviderTokens
): Promise<void> {
  try {
    await verifyCalendarAccess(provider, tokens.accessToken);
  } catch {
    throw new FlowError("Calendar-read access was not granted.");
  }
  if (!tokens.refreshToken) {
    // Without a refresh token the server could read the calendar for an hour only.
    throw new FlowError("The provider did not grant offline calendar access. Try again.");
  }
  const result = await userRepository.connectCalendarProvider(userId, provider, providerUserId);
  if (result === "conflict") {
    throw new FlowError("This calendar is already connected to another Circular Time account.");
  }
  const calendarConnectionId = await userRepository.getCalendarConnectionId(userId, provider);
  if (!calendarConnectionId) {
    throw new FlowError("The calendar connection disappeared before it could be saved.");
  }
  await calendarCredentialStore.save(userId, calendarConnectionId, tokens);
}

/**
 * Completes the flow on the provider's redirect back to the callback. Returns
 * a redirect on success, or a failure for the callback page to display. The
 * flow cookie is cleared on every outcome, so a callback cannot be replayed.
 */
export async function completeOAuthFlow(
  request: Request,
  provider: OAuthProviderId
): Promise<Response | OAuthFailure> {
  const headers = new Headers();
  headers.append("Set-Cookie", await flowCookie.serialize("", { maxAge: 0 }));
  const fail = (error: string) => ({ error });

  const params = new URL(request.url).searchParams;
  const flow: unknown = await flowCookie.parse(request.headers.get("Cookie"));
  const providerError = params.get("error");
  if (providerError) return fail(`The provider denied the request: ${providerError}`);
  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) return fail("Missing authorization code in callback.");
  if (!isPendingFlow(flow)) {
    return fail("The sign-in flow expired or is missing. Start again.");
  }
  if (flow.provider !== provider || flow.state !== state) {
    return fail("The sign-in flow does not match this callback. Start again.");
  }
  if (flow.intent !== "sign-in" && (await getUserId(request)) !== flow.userId) {
    return fail("You were signed out during this flow. Sign in and start again.");
  }

  try {
    const tokens = await exchangeAuthorizationCode(
      provider,
      { code, codeVerifier: flow.codeVerifier, redirectUri: flow.redirectUri },
      await clientCredentials(provider)
    );
    let providerUserId: string;
    try {
      providerUserId = await fetchProviderUserId(provider, tokens.accessToken);
    } catch {
      throw new FlowError("Failed to verify the account with the provider.");
    }
    if (flow.intent === "sign-in") {
      await completeSignIn(request, provider, providerUserId, headers);
    } else if (flow.intent === "link-identity") {
      await completeLink(flow.userId!, provider, providerUserId);
    } else {
      await completeCalendarConnection(flow.userId!, provider, providerUserId, tokens);
    }
  } catch (error: unknown) {
    if (error instanceof FlowError) return fail(error.message);
    // Token-endpoint, secret, and database errors carry no user-facing detail.
    console.error(`OAuth ${flow.intent} with ${provider} failed:`, error);
    return fail("Authorization could not be completed. Try again.");
  }
  return redirect(RETURN_TO[flow.intent], { headers });
}
