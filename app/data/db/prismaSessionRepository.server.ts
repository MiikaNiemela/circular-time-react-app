import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

// No import of SessionRepository here — the Data Layer must not import from
// Business Logic. Structural compatibility is checked in app/lib/session.server.ts.

/** Hashes a session token for storage and lookup. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Prisma-backed implementation of the SessionRepository interface. */
export class PrismaSessionRepository {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Stores only the hash of a new 256-bit random token and returns the token.
   * Each sign-in also removes every expired session. Expired cookies stop
   * being sent, so without this, abandoned rows would accumulate; the
   * `expiresAt` index keeps the delete cheap.
   */
  async create(userId: string, expiresAt: Date, now: Date = new Date()): Promise<string> {
    const token = randomBytes(32).toString("base64url");
    await this.db.$transaction([
      this.db.session.deleteMany({ where: { expiresAt: { lte: now } } }),
      this.db.session.create({
        data: { id: hashSessionToken(token), userId, expiresAt },
        select: { id: true },
      }),
    ]);
    return token;
  }

  /**
   * Resolves an unexpired session to its user. An expired session is deleted
   * on sight, so the server enforces the lifetime regardless of the cookie.
   */
  async findUserId(token: string, now: Date): Promise<string | null> {
    const id = hashSessionToken(token);
    const session = await this.db.session.findUnique({
      where: { id },
      select: { userId: true, expiresAt: true },
    });
    if (!session) return null;
    if (session.expiresAt <= now) {
      await this.db.session.deleteMany({ where: { id } });
      return null;
    }
    return session.userId;
  }

  /** Deletes the session row; the account and its data are untouched. */
  async revoke(token: string): Promise<void> {
    await this.db.session.deleteMany({ where: { id: hashSessionToken(token) } });
  }
}
