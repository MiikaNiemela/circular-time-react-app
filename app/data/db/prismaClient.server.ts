import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter });
}

// Reuse the client across HMR reloads in dev to avoid exhausting DB connections.
const g = globalThis as typeof globalThis & { __prisma?: PrismaClient };
g.__prisma ??= createPrismaClient();

export const prisma = g.__prisma;
