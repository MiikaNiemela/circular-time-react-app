/**
 * Application-scoped ServerEventCache singleton wired to the Prisma driver.
 * Import in route loaders and actions; never import in client-side modules.
 */
import type { ServerEventCache } from "./serverEventCache";
import { prisma } from "../data/db/prismaClient.server";
import { PrismaEventCacheRepository } from "../data/db/prismaEventCacheRepository.server";

/** The application's single ServerEventCache instance. */
export const serverEventCache: ServerEventCache = new PrismaEventCacheRepository(prisma);
