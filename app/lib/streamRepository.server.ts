/**
 * Application-scoped StreamRepository singleton wired to the Prisma driver.
 * Import in route loaders and actions; never import in client-side modules.
 */
import type { StreamRepository } from "../data/streams";
import { prisma } from "../data/db/prismaClient.server";
import { PrismaStreamRepository } from "../data/db/prismaStreamRepository.server";

/** The application's single StreamRepository instance. */
export const streamRepository: StreamRepository = new PrismaStreamRepository(prisma);
