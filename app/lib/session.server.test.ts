import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionRepository } from "./sessionRepository";

// The Prisma-backed default storage is never constructed in these tests.
vi.mock("../data/db/prismaClient.server", () => ({ prisma: {} }));

import { createCookieSessionStorage } from "react-router";
import { createApplicationSessionStorage, SESSION_MAX_AGE_SECONDS } from "./session.server";

/** In-memory SessionRepository with the same contract as the Prisma driver. */
class MemorySessionRepository implements SessionRepository {
  readonly rows = new Map<string, { userId: string; expiresAt: Date }>();
  private next = 0;

  async create(userId: string, expiresAt: Date, now: Date): Promise<string> {
    for (const [token, row] of this.rows) if (row.expiresAt <= now) this.rows.delete(token);
    const token = `token-${++this.next}`;
    this.rows.set(token, { userId, expiresAt });
    return token;
  }
  async findUserId(token: string, now: Date): Promise<string | null> {
    const row = this.rows.get(token);
    if (!row) return null;
    if (row.expiresAt <= now) {
      this.rows.delete(token);
      return null;
    }
    return row.userId;
  }
  async revoke(token: string): Promise<void> {
    this.rows.delete(token);
  }
}

const SECRET = "test-secret";
let repository: MemorySessionRepository;
let clock: Date;
let storage: ReturnType<typeof createApplicationSessionStorage>;

beforeEach(() => {
  repository = new MemorySessionRepository();
  clock = new Date("2026-10-01T00:00:00Z");
  storage = createApplicationSessionStorage(repository, SECRET, () => clock);
});

/** Signs in and returns the Cookie header value the browser would send. */
async function signIn(userId: string): Promise<string> {
  const session = await storage.getSession(null);
  session.set("userId", userId);
  const setCookie = await storage.commitSession(session);
  return setCookie.split(";")[0];
}

describe("session secret configuration", () => {
  it("rejects production startup when SESSION_SECRET is missing", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "");

    await expect(import("./session.server")).rejects.toThrow(
      "SESSION_SECRET must be set in production"
    );
    vi.unstubAllEnvs();
  });
});

describe("server-side application sessions", () => {
  it("stores the session server-side and keeps only an opaque token in the cookie", async () => {
    const cookie = await signIn("user-1");

    expect(repository.rows.size).toBe(1);
    expect(cookie).not.toContain("user-1");
    expect((await storage.getSession(cookie)).get("userId")).toBe("user-1");
  });

  it("sets the server-side expiry to the session lifetime", async () => {
    await signIn("user-1");

    const [row] = [...repository.rows.values()];
    expect(row.expiresAt.getTime() - clock.getTime()).toBe(SESSION_MAX_AGE_SECONDS * 1000);
  });

  it("revokes the session on sign-out so a replayed cookie no longer authenticates", async () => {
    const cookie = await signIn("user-1");

    const setCookie = await storage.destroySession(await storage.getSession(cookie));

    expect(setCookie).toContain("Expires=Thu, 01 Jan 1970");
    expect(repository.rows.size).toBe(0);
    expect((await storage.getSession(cookie)).get("userId")).toBeUndefined();
  });

  it("revokes only the signed-out session", async () => {
    const laptop = await signIn("user-1");
    const phone = await signIn("user-1");

    await storage.destroySession(await storage.getSession(laptop));

    expect((await storage.getSession(phone)).get("userId")).toBe("user-1");
  });

  it("rejects an expired session server-side even if the cookie is replayed", async () => {
    const cookie = await signIn("user-1");
    clock = new Date(clock.getTime() + SESSION_MAX_AGE_SECONDS * 1000);

    expect((await storage.getSession(cookie)).get("userId")).toBeUndefined();
    expect(repository.rows.size).toBe(0);
  });

  it("passes the issue time so the store can prune sessions that have expired", async () => {
    await signIn("user-1");
    clock = new Date(clock.getTime() + SESSION_MAX_AGE_SECONDS * 1000);

    await signIn("user-2");

    expect([...repository.rows.values()].map((row) => row.userId)).toEqual(["user-2"]);
  });

  it("rejects a cookie that was not signed with the session secret", async () => {
    const cookie = await signIn("user-1");
    const forged = createApplicationSessionStorage(repository, "other-secret", () => clock);

    expect((await forged.getSession(cookie)).get("userId")).toBeUndefined();
  });

  it("refuses to modify an existing session", async () => {
    const session = await storage.getSession(await signIn("user-1"));
    session.set("userId", "user-2");

    await expect(storage.commitSession(session)).rejects.toThrow(/immutable/);
  });
});

describe("cookies from the earlier session format", () => {
  /** A cookie written by the previous cookie-only storage with the same secret. */
  async function legacyCookie(): Promise<string> {
    const legacy = createCookieSessionStorage({
      cookie: { name: "__session", secrets: [SECRET], httpOnly: true, sameSite: "lax", path: "/" },
    });
    const session = await legacy.getSession(null);
    session.set("userId", "user-a");
    return (await legacy.commitSession(session)).split(";")[0];
  }

  it("treats a legacy cookie as signed out without querying the store", async () => {
    const findUserId = vi.spyOn(repository, "findUserId");

    const session = await storage.getSession(await legacyCookie());

    expect(session.get("userId")).toBeUndefined();
    expect(findUserId).not.toHaveBeenCalled();
  });

  it("signs out a legacy cookie without error", async () => {
    const revoke = vi.spyOn(repository, "revoke");
    const session = await storage.getSession(await legacyCookie());

    await expect(storage.destroySession(session)).resolves.toContain(
      "Expires=Thu, 01 Jan 1970 00:00:00 GMT"
    );
    expect(revoke).not.toHaveBeenCalled();
  });
});

describe("getUserId", () => {
  it("returns null without a session cookie and does not query the store", async () => {
    vi.resetModules();
    const findUserId = vi.fn();
    vi.doMock("../data/db/prismaSessionRepository.server", () => ({
      PrismaSessionRepository: class {
        findUserId = findUserId;
      },
    }));
    const { getUserId } = await import("./session.server");

    await expect(getUserId(new Request("http://localhost/"))).resolves.toBeNull();
    await expect(
      getUserId(new Request("http://localhost/", { headers: { Cookie: "theme=dark" } }))
    ).resolves.toBeNull();
    expect(findUserId).not.toHaveBeenCalled();
    vi.doUnmock("../data/db/prismaSessionRepository.server");
  });
});
