/**
 * Server-side application sessions behind an HTTP-only signed cookie.
 *
 * The cookie carries only an opaque random token. Each request resolves the
 * token against the session store, so signing out revokes the session on the
 * server: a copy of the cookie taken earlier no longer authenticates.
 * SESSION_SECRET signs the cookie and must be set in production; a fixed
 * fallback is used in development.
 */
import { createCookie, createSessionStorage, type SessionStorage } from "react-router";
import type { SessionRepository } from "./sessionRepository";

type SessionData = {
  /** Stable database user ID (UUID) assigned on first sign-in. */
  userId: string;
};

/** Session lifetime, enforced by both the cookie and the server-side record. */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const sessionSecret = process.env.SESSION_SECRET;
if (process.env.NODE_ENV === "production" && !sessionSecret) {
  throw new Error("SESSION_SECRET must be set in production");
}

/**
 * Builds session storage over a repository. Sessions are immutable: a sign-in
 * always creates a new session, which also prevents session fixation.
 */
export function createApplicationSessionStorage(
  repository: SessionRepository,
  secret: string,
  now: () => Date = () => new Date()
): SessionStorage<SessionData> {
  const cookie = createCookie("__session", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secrets: [secret],
    // Secure flag on in production; off in dev so http://localhost works.
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return createSessionStorage<SessionData>({
    cookie,
    async createData(data) {
      if (!data.userId) throw new Error("A session requires a userId");
      // The server-side record is the authority on lifetime; the cookie's own
      // expiry only tells the browser when to stop sending it.
      return repository.create(
        data.userId,
        new Date(now().getTime() + SESSION_MAX_AGE_SECONDS * 1000)
      );
    },
    async readData(token) {
      const userId = await repository.findUserId(token, now());
      return userId ? { userId } : null;
    },
    async updateData() {
      throw new Error("Application sessions are immutable; create a new session instead");
    },
    async deleteData(token) {
      if (token) await repository.revoke(token);
    },
  });
}

async function createDefaultStorage(): Promise<SessionStorage<SessionData>> {
  const [{ prisma }, { PrismaSessionRepository }] = await Promise.all([
    import("../data/db/prismaClient.server"),
    import("../data/db/prismaSessionRepository.server"),
  ]);
  const repository: SessionRepository = new PrismaSessionRepository(prisma);
  return createApplicationSessionStorage(
    repository,
    sessionSecret ?? "dev-secret-change-in-production"
  );
}

let storage: Promise<SessionStorage<SessionData>> | undefined;
function sessionStorage(): Promise<SessionStorage<SessionData>> {
  storage ??= createDefaultStorage();
  return storage;
}

/** Parses the session from the incoming Cookie header; returns an empty session when absent. */
export const getSession: SessionStorage<SessionData>["getSession"] = async (...args) =>
  (await sessionStorage()).getSession(...args);
/** Creates the session record and serializes its token into a Set-Cookie header value. */
export const commitSession: SessionStorage<SessionData>["commitSession"] = async (...args) =>
  (await sessionStorage()).commitSession(...args);
/** Revokes the session record and returns a Set-Cookie header value that clears the cookie. */
export const destroySession: SessionStorage<SessionData>["destroySession"] = async (...args) =>
  (await sessionStorage()).destroySession(...args);

/**
 * Reads the userId of a live session.
 * Returns null when no cookie is present, the signature is invalid, or the
 * session has been revoked or has expired.
 */
export async function getUserId(request: Request): Promise<string | null> {
  const cookieHeader = request.headers.get("Cookie");
  // Avoid a database round trip for anonymous requests.
  if (!cookieHeader?.includes("__session=")) return null;
  const session = await getSession(cookieHeader);
  return session.get("userId") ?? null;
}
