import type { PrismaClient } from "@prisma/client";

// No import of CalendarCredentialRepository here — the Data Layer must not
// import from Business Logic. Structural compatibility is checked where the
// repository is wired, in app/lib/calendarCredentials.server.ts.

/**
 * Stores encrypted provider credentials per calendar connection. The
 * repository only ever sees ciphertext; encryption happens in the business
 * layer. The composite foreign key to (connection, user) means a credential
 * can only be written for a connection its user owns, and deleting the
 * connection deletes the credential.
 */
export class PrismaCalendarCredentialRepository {
  constructor(private readonly db: PrismaClient) {}

  /** Creates or replaces the credential for a user's calendar connection. */
  async save(userId: string, calendarConnectionId: string, ciphertext: string): Promise<void> {
    await this.db.calendarCredential.upsert({
      where: { calendarConnectionId_userId: { calendarConnectionId, userId } },
      create: { calendarConnectionId, userId, ciphertext },
      update: { ciphertext },
      select: { calendarConnectionId: true },
    });
  }

  /** Returns the stored ciphertext, or null when the user has none for the connection. */
  async load(userId: string, calendarConnectionId: string): Promise<string | null> {
    const row = await this.db.calendarCredential.findUnique({
      where: { calendarConnectionId_userId: { calendarConnectionId, userId } },
      select: { ciphertext: true },
    });
    return row?.ciphertext ?? null;
  }
}
