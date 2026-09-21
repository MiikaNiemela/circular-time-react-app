import { describe, it, expect, vi, beforeEach } from "vitest";
import { PrismaUserRepository } from "./prismaUserRepository.server";
import type { PrismaClient } from "@prisma/client";

describe("PrismaUserRepository", () => {
  let upsert: ReturnType<typeof vi.fn>;
  let findMany: ReturnType<typeof vi.fn>;
  let repo: PrismaUserRepository;

  beforeEach(() => {
    upsert = vi.fn();
    findMany = vi.fn();
    const db = {
      providerAccount: { upsert, findMany },
    } as unknown as PrismaClient;
    repo = new PrismaUserRepository(db);
  });

  it("returns the existing userId when the ProviderAccount already exists", async () => {
    upsert.mockResolvedValue({ userId: "existing-uuid" });
    const result = await repo.upsertUser("google", "google-sub-123");
    expect(result).toBe("existing-uuid");
  });

  it("returns the new userId when no ProviderAccount exists", async () => {
    upsert.mockResolvedValue({ userId: "new-uuid" });
    const result = await repo.upsertUser("google", "google-sub-123");
    expect(result).toBe("new-uuid");
  });

  it("calls upsert with the correct provider and providerUserId", async () => {
    upsert.mockResolvedValue({ userId: "uuid-456" });
    await repo.upsertUser("outlook", "outlook-id-abc");
    expect(upsert).toHaveBeenCalledWith({
      where: {
        provider_providerUserId: { provider: "outlook", providerUserId: "outlook-id-abc" },
      },
      update: {},
      create: {
        provider: "outlook",
        providerUserId: "outlook-id-abc",
        user: { create: {} },
      },
      select: { userId: true },
    });
  });

  it("returns the userId for a second distinct provider account", async () => {
    upsert.mockResolvedValue({ userId: "another-uuid" });
    const result = await repo.upsertUser("outlook", "outlook-id-xyz");
    expect(result).toBe("another-uuid");
  });

  describe("getConnectedProviders", () => {
    it("returns provider ids for all linked accounts", async () => {
      findMany.mockResolvedValue([{ provider: "google" }, { provider: "outlook" }]);
      const result = await repo.getConnectedProviders("user-uuid");
      expect(result).toEqual(["google", "outlook"]);
      expect(findMany).toHaveBeenCalledWith({
        where: { userId: "user-uuid" },
        select: { provider: true },
      });
    });

    it("returns an empty array when the user has no linked accounts", async () => {
      findMany.mockResolvedValue([]);
      const result = await repo.getConnectedProviders("user-uuid");
      expect(result).toEqual([]);
    });
  });
});
