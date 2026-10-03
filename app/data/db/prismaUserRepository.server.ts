import { Prisma, type PrismaClient } from "@prisma/client";

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function isTransactionConflictError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2034";
}

// No import of UserRepository here — the Data Layer must not import from Business Logic.
// Structural compatibility with UserRepository is enforced at the assignment in
// app/lib/userRepository.server.ts (Business Logic), where TypeScript checks the shape.
/** Prisma-backed implementation of the UserRepository interface. */
export class PrismaUserRepository {
  constructor(private readonly db: PrismaClient) {}

  /** Retries a serializable identity operation when PostgreSQL detects a race. */
  private async runSerializable<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.db.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error: unknown) {
        if (!isTransactionConflictError(error) || attempt === 2) throw error;
        lastError = error;
      }
    }
    throw lastError;
  }

  /**
   * Links a provider identity to an existing application account. A provider
   * identity may belong to only one account, so a pre-existing different owner
   * is reported without creating or merging accounts. The account's own
   * calendar connection for the same identity proves the same person holds it,
   * so it does not block linking; another account's connection does.
   */
  async linkProviderAccount(
    userId: string,
    provider: string,
    providerUserId: string
  ): Promise<"linked" | "conflict" | "provider-already-linked"> {
    try {
      return await this.runSerializable(async (tx) => {
        const existingAccount = await tx.providerAccount.findUnique({
          where: { provider_providerUserId: { provider, providerUserId } },
          select: { userId: true },
        });
        if (existingAccount) return existingAccount.userId === userId ? "linked" : "conflict";

        const calendarConnection = await tx.calendarConnection.findUnique({
          where: { provider_providerUserId: { provider, providerUserId } },
          select: { userId: true },
        });
        if (calendarConnection && calendarConnection.userId !== userId) return "conflict";

        const sameProviderIdentity = await tx.providerAccount.findUnique({
          where: { userId_provider: { userId, provider } },
          select: { id: true },
        });
        if (sameProviderIdentity) return "provider-already-linked";

        await tx.providerAccount.create({
          data: { provider, providerUserId, userId },
          select: { userId: true },
        });
        return "linked";
      });
    } catch (error: unknown) {
      // A concurrent link for the same identity or provider won the race.
      if (isUniqueConstraintError(error)) return "conflict";
      throw error;
    }
  }

  /**
   * Stores a verified calendar identity separately from identities that can
   * establish an application session. A serializable pre-read of the matching
   * sign-in identity excludes a concurrent calendar-only/sign-in race.
   */
  async connectCalendarProvider(
    userId: string,
    provider: string,
    providerUserId: string,
    sealCredential: (calendarConnectionId: string) => string
  ): Promise<"connected" | "conflict"> {
    try {
      return await this.runSerializable(async (tx) => {
        await tx.providerAccount.findUnique({
          where: { provider_providerUserId: { provider, providerUserId } },
          select: { id: true },
        });
        const connection = await tx.calendarConnection.upsert({
          where: { provider_providerUserId: { provider, providerUserId } },
          update: {},
          create: { provider, providerUserId, userId },
          select: { id: true, userId: true },
        });
        if (connection.userId !== userId) return "conflict";
        // Stored in the same transaction, so a failed credential write also
        // rolls back a newly created connection: a calendar is never shown as
        // connected without a usable credential.
        const ciphertext = sealCredential(connection.id);
        await tx.calendarCredential.upsert({
          where: {
            calendarConnectionId_userId: { calendarConnectionId: connection.id, userId },
          },
          create: { calendarConnectionId: connection.id, userId, ciphertext },
          update: { ciphertext },
          select: { calendarConnectionId: true },
        });
        return "connected";
      });
    } catch (error: unknown) {
      // The user already has a different identity for this provider, or the
      // requested identity is concurrently connected by another account.
      if (isUniqueConstraintError(error)) return "conflict";
      throw error;
    }
  }

  /**
   * Removes calendar access and all server-side cached events in one database
   * transaction. Application sign-in identities are not affected.
   */
  async disconnectCalendarProvider(userId: string, provider: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      await tx.calendarConnection.deleteMany({
        where: { userId, provider },
      });
      await tx.cachedEventRange.deleteMany({
        where: { userId, calendarId: provider },
      });
    });
  }

  /**
   * Returns an active connection only when its immutable ID belongs to the
   * current application account. The cache route uses providerUserId to bind an
   * untrusted browser token to this exact connection before accepting events.
   */
  async getCalendarConnection(
    userId: string,
    calendarConnectionId: string
  ): Promise<{ id: string; provider: string; providerUserId: string } | null> {
    return this.db.calendarConnection.findUnique({
      where: { id_userId: { id: calendarConnectionId, userId } },
      select: { id: true, provider: true, providerUserId: true },
    });
  }

  /** Returns the immutable connection ID used to bind one cache write. */
  async getCalendarConnectionId(userId: string, provider: string): Promise<string | null> {
    const connection = await this.db.calendarConnection.findUnique({
      where: { userId_provider: { userId, provider } },
      select: { id: true },
    });
    return connection?.id ?? null;
  }

  /** Returns immutable IDs and provider identities for the user's active connections. */
  async getCalendarConnections(
    userId: string
  ): Promise<Array<{ id: string; provider: string; providerUserId: string }>> {
    return this.db.calendarConnection.findMany({
      where: { userId },
      select: { id: true, provider: true, providerUserId: true },
    });
  }

  /** Lists every calendar connection, across accounts, that has stored credentials. */
  async listRefreshableCalendarConnections(): Promise<
    Array<{ id: string; userId: string; provider: string; providerUserId: string }>
  > {
    return this.db.calendarConnection.findMany({
      where: { credential: { isNot: null } },
      select: { id: true, userId: true, provider: true, providerUserId: true },
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Unlinks one provider's sign-in identity. The count and the delete run in
   * one serializable transaction, so two concurrent removals cannot leave the
   * account without any sign-in identity.
   */
  async removeSignInIdentity(
    userId: string,
    provider: string
  ): Promise<"removed" | "last-identity" | "not-linked"> {
    return this.runSerializable(async (tx) => {
      const accounts = await tx.providerAccount.findMany({
        where: { userId },
        select: { provider: true },
      });
      if (!accounts.some((account) => account.provider === provider)) return "not-linked";
      if (accounts.length <= 1) return "last-identity";
      await tx.providerAccount.deleteMany({ where: { userId, provider } });
      return "removed";
    });
  }

  /** Lists the providers whose identities can sign in to the application account. */
  async getSignInProviders(userId: string): Promise<string[]> {
    const accounts = await this.db.providerAccount.findMany({
      where: { userId },
      select: { provider: true },
      orderBy: { createdAt: "asc" },
    });
    return accounts.map((account) => account.provider);
  }

  /** Lists the calendar providers explicitly connected by the user. */
  async getConnectedProviders(userId: string): Promise<string[]> {
    const connections = await this.db.calendarConnection.findMany({
      where: { userId },
      select: { provider: true },
    });
    return connections.map((connection) => connection.provider);
  }

  /**
   * Resolves or creates an application identity atomically. A pre-existing
   * ProviderAccount always remains a valid sign-in identity, even if that
   * account also has the same provider connected for calendar access. A
   * calendar connection without a ProviderAccount is rejected as calendar-only.
   */
  async signInWithProvider(
    provider: string,
    providerUserId: string
  ): Promise<{ kind: "signed-in"; userId: string } | { kind: "calendar-only" }> {
    return this.runSerializable(async (tx) => {
      const existingAccount = await tx.providerAccount.findUnique({
        where: { provider_providerUserId: { provider, providerUserId } },
        select: { userId: true },
      });
      if (existingAccount) return { kind: "signed-in", userId: existingAccount.userId };

      const calendarConnection = await tx.calendarConnection.findUnique({
        where: { provider_providerUserId: { provider, providerUserId } },
        select: { id: true },
      });
      if (calendarConnection) return { kind: "calendar-only" };

      const account = await tx.providerAccount.create({
        data: {
          provider,
          providerUserId,
          user: { create: {} },
        },
        select: { userId: true },
      });
      return { kind: "signed-in", userId: account.userId };
    });
  }
}
