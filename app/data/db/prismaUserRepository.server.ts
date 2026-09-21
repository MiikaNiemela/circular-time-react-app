import type { PrismaClient } from "@prisma/client";

// No import of UserRepository here — the Data Layer must not import from Business Logic.
// Structural compatibility with UserRepository is enforced at the assignment in
// app/lib/userRepository.server.ts (Business Logic), where TypeScript checks the shape.
/** Prisma-backed implementation of the UserRepository interface. */
export class PrismaUserRepository {
  constructor(private readonly db: PrismaClient) {}

  /** Lists the provider IDs linked to a user by querying ProviderAccount rows. */
  async getConnectedProviders(userId: string): Promise<string[]> {
    const accounts = await this.db.providerAccount.findMany({
      where: { userId },
      select: { provider: true },
    });
    return accounts.map((a) => a.provider);
  }

  /**
   * Atomically upserts the ProviderAccount (and its parent User on first sign-in)
   * using a single Prisma upsert to avoid a race on concurrent sign-ins.
   */
  async upsertUser(provider: string, providerUserId: string): Promise<string> {
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
