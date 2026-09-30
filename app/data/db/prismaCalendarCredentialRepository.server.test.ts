import { describe, it, expect, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { PrismaCalendarCredentialRepository } from "./prismaCalendarCredentialRepository.server";

function repositoryWith(overrides: { upsert?: unknown; findUnique?: unknown }) {
  const upsert = vi.fn(overrides.upsert as never);
  const findUnique = vi.fn(overrides.findUnique as never);
  const db = { calendarCredential: { upsert, findUnique } } as unknown as PrismaClient;
  return { repository: new PrismaCalendarCredentialRepository(db), upsert, findUnique };
}

describe("PrismaCalendarCredentialRepository", () => {
  it("upserts ciphertext keyed by both the connection and its owning user", async () => {
    const { repository, upsert } = repositoryWith({ upsert: async () => ({}) });

    await repository.save("user-1", "connection-1", "v1.iv.body");

    expect(upsert).toHaveBeenCalledWith({
      where: {
        calendarConnectionId_userId: { calendarConnectionId: "connection-1", userId: "user-1" },
      },
      create: { calendarConnectionId: "connection-1", userId: "user-1", ciphertext: "v1.iv.body" },
      update: { ciphertext: "v1.iv.body" },
      select: { calendarConnectionId: true },
    });
  });

  it("loads ciphertext only for the owning user", async () => {
    const { repository, findUnique } = repositoryWith({
      findUnique: async () => ({ ciphertext: "v1.iv.body" }),
    });

    await expect(repository.load("user-1", "connection-1")).resolves.toBe("v1.iv.body");
    expect(findUnique).toHaveBeenCalledWith({
      where: {
        calendarConnectionId_userId: { calendarConnectionId: "connection-1", userId: "user-1" },
      },
      select: { ciphertext: true },
    });
  });

  it("returns null when no credential exists", async () => {
    const { repository } = repositoryWith({ findUnique: async () => null });

    await expect(repository.load("user-1", "connection-1")).resolves.toBeNull();
  });
});
