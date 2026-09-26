import type { PrismaClient } from "@prisma/client";

// No import of UserRepository here — the Data Layer must not import from Business Logic.
// Structural compatibility with UserRepository is enforced at the assignment in
// app/lib/userRepository.server.ts (Business Logic), where TypeScript checks the shape.
/** Prisma-backed implementation of the UserRepository interface. */
export class PrismaUserRepository {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Links a provider identity to an existing application account. A provider
   * identity may belong to only one account, so a pre-existing different owner
   * is reported without creating or merging accounts.
   */
  async linkProviderAccount(
    userId: string,
    provider: string,
    providerUserId: string
  ): Promise<"linked" | "conflict"> {
    const account = await this.db.providerAccount.upsert({
      where: { provider_providerUserId: { provider, providerUserId } },
      update: {},
      create: { provider, providerUserId, userId },
      select: { userId: true },
    });
    return account.userId === userId ? "linked" : "conflict";
  }

  /**
   * Marks a linked provider identity as an explicit calendar connection. The
   * ownership check happens before the update so another account's identity can
   * never be activated by the current user.
   */
  async connectCalendarProvider(
    userId: string,
    provider: string,
    providerUserId: string
  ): Promise<"connected" | "conflict"> {
    const account = await this.db.providerAccount.upsert({
      where: { provider_providerUserId: { provider, providerUserId } },
      update: {},
      create: { provider, providerUserId, userId, calendarConnected: true },
      select: { userId: true },
    });
    if (account.userId !== userId) return "conflict";

    await this.db.providerAccount.update({
      where: { provider_providerUserId: { provider, providerUserId } },
      data: { calendarConnected: true },
    });
    return "connected";
  }

  /** Lists the calendar providers explicitly connected by the user. */
  async getConnectedProviders(userId: string): Promise<string[]> {
    const accounts = await this.db.providerAccount.findMany({
      where: { userId, calendarConnected: true },
      select: { provider: true },
    });
    return accounts.map((a) => a.provider);
  }

  /**
   * Atomically upserts the ProviderAccount (and its parent User on first sign-in)
   * using a single Prisma upsert to avoid a race on concurrent sign-ins.
   */
  async signInWithProvider(provider: string, providerUserId: string): Promise<string> {
    const account = await this.db.providerAccount.upsert({
      where: { provider_providerUserId: { provider, providerUserId } },
      update: {},
      create: {
        provider,
        providerUserId,
        user: { create: {} },
      },
      select: { userId: true },
    });
    return account.userId;
  }
}
