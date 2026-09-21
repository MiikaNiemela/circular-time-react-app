/**
 * Application-scoped UserRepository singleton wired to the Prisma driver.
 * Import in route loaders and actions; never import in client-side modules.
 */
import type { UserRepository } from "./userRepository";
import { prisma } from "../data/db/prismaClient.server";
import { PrismaUserRepository } from "../data/db/prismaUserRepository.server";

/** The application's single UserRepository instance. */
export const userRepository: UserRepository = new PrismaUserRepository(prisma);
