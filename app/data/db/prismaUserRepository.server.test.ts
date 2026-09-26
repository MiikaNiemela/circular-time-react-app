import { describe, it, expect, vi, beforeEach } from "vitest";
import { PrismaUserRepository } from "./prismaUserRepository.server";
import type { PrismaClient } from "@prisma/client";

describe("PrismaUserRepository", () => {
  let upsert: ReturnType<typeof vi.fn>;
  let findMany: ReturnType<typeof vi.fn>;
  let update: ReturnType<typeof vi.fn>;
  let repo: PrismaUserRepository;

  beforeEach(() => {
    upsert = vi.fn();
    findMany = vi.fn();
    update = vi.fn();
    const db = {
      providerAccount: { upsert, findMany, update },
    } as unknown as PrismaClient;
    repo = new PrismaUserRepository(db);
  });

  it("returns the existing userId when the ProviderAccount already exists", async () => {
    upsert.mockResolvedValue({ userId: "existing-uuid" });
    const result = await repo.signInWithProvider("google", "google-sub-123");
    expect(result).toBe("existing-uuid");
  });

  it("returns the new userId when no ProviderAccount exists", async () => {
    upsert.mockResolvedValue({ userId: "new-uuid" });
    const result = await repo.signInWithProvider("google", "google-sub-123");
    expect(result).toBe("new-uuid");
  });

  it("calls upsert with the correct provider and providerUserId", async () => {
    upsert.mockResolvedValue({ userId: "uuid-456" });
    await repo.signInWithProvider("outlook", "outlook-id-abc");
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
    const result = await repo.signInWithProvider("outlook", "outlook-id-xyz");
    expect(result).toBe("another-uuid");
  });

  describe("linkProviderAccount", () => {
    it("links a new provider identity to the signed-in user", async () => {
      upsert.mockResolvedValue({ userId: "user-uuid" });

      const result = await repo.linkProviderAccount("user-uuid", "outlook", "outlook-id-abc");

      expect(result).toBe("linked");
      expect(upsert).toHaveBeenCalledWith({
        where: {
          provider_providerUserId: { provider: "outlook", providerUserId: "outlook-id-abc" },
        },
        update: {},
        create: {
          provider: "outlook",
          providerUserId: "outlook-id-abc",
          userId: "user-uuid",
        },
        select: { userId: true },
      });
    });

    it("reports a conflict when the provider identity belongs to another user", async () => {
      upsert.mockResolvedValue({ userId: "other-user-uuid" });

      await expect(repo.linkProviderAccount("user-uuid", "google", "google-sub-123")).resolves.toBe(
        "conflict"
      );
    });
  });

  describe("connectCalendarProvider", () => {
    it("marks a provider identity owned by the signed-in user as calendar-connected", async () => {
      upsert.mockResolvedValue({ userId: "user-uuid" });
      update.mockResolvedValue({});

      const result = await repo.connectCalendarProvider("user-uuid", "outlook", "outlook-id-abc");

      expect(result).toBe("connected");
      expect(upsert).toHaveBeenCalledWith({
        where: {
          provider_providerUserId: { provider: "outlook", providerUserId: "outlook-id-abc" },
        },
        update: {},
        create: {
          provider: "outlook",
          providerUserId: "outlook-id-abc",
          userId: "user-uuid",
          calendarConnected: true,
        },
        select: { userId: true },
      });
      expect(update).toHaveBeenCalledWith({
        where: {
          provider_providerUserId: { provider: "outlook", providerUserId: "outlook-id-abc" },
        },
        data: { calendarConnected: true },
      });
    });

    it("does not activate a provider identity owned by another application account", async () => {
      upsert.mockResolvedValue({ userId: "other-user-uuid" });

      await expect(
        repo.connectCalendarProvider("user-uuid", "google", "google-sub-123")
      ).resolves.toBe("conflict");
      expect(update).not.toHaveBeenCalled();
    });
  });

  describe("getConnectedProviders", () => {
    it("returns calendar providers that have been explicitly connected", async () => {
      findMany.mockResolvedValue([{ provider: "google" }, { provider: "outlook" }]);
      const result = await repo.getConnectedProviders("user-uuid");
      expect(result).toEqual(["google", "outlook"]);
      expect(findMany).toHaveBeenCalledWith({
        where: { userId: "user-uuid", calendarConnected: true },
        select: { provider: true },
      });
    });

    it("returns an empty array when the user has no connected calendars", async () => {
      findMany.mockResolvedValue([]);
      const result = await repo.getConnectedProviders("user-uuid");
      expect(result).toEqual([]);
    });
  });
});
