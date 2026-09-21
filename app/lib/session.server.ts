/**
 * HTTP-only signed session cookie for server-side user identity.
 *
 * After a successful OAuth exchange the client POSTs to /auth/session, which
 * calls getUserId to read the resulting cookie on every subsequent request.
 * SESSION_SECRET must be set in production; a fixed fallback is used in dev so
 * server restarts don't invalidate sessions.
 */
import { createCookieSessionStorage } from "react-router";

type SessionData = {
  /** Stable database user ID (UUID) assigned on first sign-in. */
  userId: string;
};

const { getSession, commitSession, destroySession } = createCookieSessionStorage<SessionData>({
  cookie: {
    name: "__session",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secrets: [process.env.SESSION_SECRET ?? "dev-secret-change-in-production"],
    // Secure flag on in production; off in dev so http://localhost works.
    secure: process.env.NODE_ENV === "production",
    maxAge: 30 * 24 * 60 * 60,
  },
});

/** Parses the session from the incoming Cookie header; returns an empty session when absent. */
export { getSession };
/** Serializes session data into a Set-Cookie header value, ready to attach to a Response. */
export { commitSession };
/** Produces a Set-Cookie header value that instructs the browser to clear the session cookie. */
export { destroySession };

/**
 * Reads the userId from the session cookie.
 * Returns null when no session exists or the cookie is invalid.
 */
export async function getUserId(request: Request): Promise<string | null> {
  const session = await getSession(request.headers.get("Cookie"));
  return session.get("userId") ?? null;
}
