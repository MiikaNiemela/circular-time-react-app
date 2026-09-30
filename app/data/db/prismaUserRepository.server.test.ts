import { describe, it, expect, vi, beforeEach } from "vitest";
import { PrismaUserRepository } from "./prismaUserRepository.server";
import type { PrismaClient } from "@prisma/client";

describe("PrismaUserRepository", () => {
  let upsert: ReturnType<typeof vi.fn>;
  let findMany: ReturnType<typeof vi.fn>;
  let providerAccountFindUnique: ReturnType<typeof vi.fn>;
  let providerAccountCreate: ReturnType<typeof vi.fn>;
  let calendarConnectionUpsert: ReturnType<typeof vi.fn>;
  let calendarConnectionFindMany: ReturnType<typeof vi.fn>;
  let calendarConnectionFindUnique: ReturnType<typeof vi.fn>;
  let update: ReturnType<typeof vi.fn>;
  let calendarConnectionDeleteMany: ReturnType<typeof vi.fn>;
  let calendarCredentialUpsert: ReturnType<typeof vi.fn>;
  let deleteMany: ReturnType<typeof vi.fn>;
  let transaction: ReturnType<typeof vi.fn>;
  let repo: PrismaUserRepository;

  beforeEach(() => {
    upsert = vi.fn();
    findMany = vi.fn();
    providerAccountFindUnique = vi.fn();
    providerAccountCreate = vi.fn();
    calendarConnectionUpsert = vi.fn();
    calendarConnectionFindMany = vi.fn();
    calendarConnectionFindUnique = vi.fn();
    update = vi.fn();
    calendarConnectionDeleteMany = vi.fn();
    calendarCredentialUpsert = vi.fn();
    deleteMany = vi.fn();
    transaction = vi.fn(async (callback: (tx: unknown) => unknown) =>
      callback({
        providerAccount: {
          findUnique: providerAccountFindUnique,
          create: providerAccountCreate,
        },
        calendarConnection: {
          upsert: calendarConnectionUpsert,
          findUnique: calendarConnectionFindUnique,
          deleteMany: calendarConnectionDeleteMany,
        },
        cachedEventRange: { deleteMany },
        calendarCredential: { upsert: calendarCredentialUpsert },
      })
    );
    const db = {
      providerAccount: { upsert, findMany, update },
      calendarConnection: {
        upsert: calendarConnectionUpsert,
        findMany: calendarConnectionFindMany,
        findUnique: calendarConnectionFindUnique,
      },
      $transaction: transaction,
    } as unknown as PrismaClient;
    repo = new PrismaUserRepository(db);
  });

  describe("signInWithProvider", () => {
    it("allows an existing application identity even when it also has calendar access", async () => {
      providerAccountFindUnique.mockResolvedValue({ userId: "existing-uuid" });

      await expect(repo.signInWithProvider("google", "google-sub-123")).resolves.toEqual({
        kind: "signed-in",
        userId: "existing-uuid",
      });
      expect(calendarConnectionFindUnique).not.toHaveBeenCalled();
    });

    it("rejects an identity that exists only as a calendar connection", async () => {
      providerAccountFindUnique.mockResolvedValue(null);
      calendarConnectionFindUnique.mockResolvedValue({ userId: "calendar-owner-uuid" });

      await expect(repo.signInWithProvider("google", "google-sub-123")).resolves.toEqual({
        kind: "calendar-only",
      });
      expect(providerAccountCreate).not.toHaveBeenCalled();
    });

    it("creates an application identity when neither identity record exists", async () => {
      providerAccountFindUnique.mockResolvedValue(null);
      calendarConnectionFindUnique.mockResolvedValue(null);
      providerAccountCreate.mockResolvedValue({ userId: "new-uuid" });

      await expect(repo.signInWithProvider("google", "google-sub-123")).resolves.toEqual({
        kind: "signed-in",
        userId: "new-uuid",
      });
      expect(providerAccountCreate).toHaveBeenCalledWith({
        data: {
          provider: "google",
          providerUserId: "google-sub-123",
          user: { create: {} },
        },
        select: { userId: true },
      });
    });

    it("retries a serializable sign-in when a concurrent calendar connection wins the first attempt", async () => {
      providerAccountFindUnique.mockResolvedValue({ userId: "existing-uuid" });
      transaction
        .mockRejectedValueOnce({ code: "P2034" })
        .mockImplementationOnce(async (callback: (tx: unknown) => unknown) =>
          callback({
            providerAccount: {
              findUnique: providerAccountFindUnique,
              create: providerAccountCreate,
            },
            calendarConnection: {
              findUnique: calendarConnectionFindUnique,
              upsert: calendarConnectionUpsert,
              deleteMany: calendarConnectionDeleteMany,
            },
            cachedEventRange: { deleteMany },
          })
        );

      await expect(repo.signInWithProvider("google", "google-sub-123")).resolves.toEqual({
        kind: "signed-in",
        userId: "existing-uuid",
      });
      expect(transaction).toHaveBeenCalledTimes(2);
    });

    it("uses serializable transactions to exclude concurrent calendar-only connections", async () => {
      providerAccountFindUnique.mockResolvedValue({ userId: "existing-uuid" });

      await repo.signInWithProvider("outlook", "outlook-id-abc");

      expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
        isolationLevel: "Serializable",
      });
    });
  });

  describe("linkProviderAccount", () => {
    it("links a new provider identity to the signed-in user", async () => {
      providerAccountFindUnique.mockResolvedValue(null);
      calendarConnectionFindUnique.mockResolvedValue(null);
      providerAccountCreate.mockResolvedValue({ userId: "user-uuid" });

      const result = await repo.linkProviderAccount("user-uuid", "outlook", "outlook-id-abc");

      expect(result).toBe("linked");
      expect(providerAccountCreate).toHaveBeenCalledWith({
        data: {
          provider: "outlook",
          providerUserId: "outlook-id-abc",
          userId: "user-uuid",
        },
        select: { userId: true },
      });
      expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
        isolationLevel: "Serializable",
      });
    });

    it("is idempotent when the identity is already linked to the same user", async () => {
      providerAccountFindUnique.mockResolvedValue({ userId: "user-uuid" });

      await expect(repo.linkProviderAccount("user-uuid", "google", "google-sub-123")).resolves.toBe(
        "linked"
      );
      expect(providerAccountCreate).not.toHaveBeenCalled();
    });

    it("reports a conflict and never merges when the identity belongs to another user", async () => {
      providerAccountFindUnique.mockResolvedValue({ userId: "other-user-uuid" });

      await expect(repo.linkProviderAccount("user-uuid", "google", "google-sub-123")).resolves.toBe(
        "conflict"
      );
      expect(providerAccountCreate).not.toHaveBeenCalled();
    });

    it("reports a conflict when another user has the identity as a calendar connection", async () => {
      providerAccountFindUnique.mockResolvedValue(null);
      calendarConnectionFindUnique.mockResolvedValue({ userId: "other-user-uuid" });

      await expect(repo.linkProviderAccount("user-uuid", "google", "google-sub-123")).resolves.toBe(
        "conflict"
      );
      expect(providerAccountCreate).not.toHaveBeenCalled();
    });

    it("links an identity the same user already connected as a calendar", async () => {
      providerAccountFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      calendarConnectionFindUnique.mockResolvedValue({ userId: "user-uuid" });
      providerAccountCreate.mockResolvedValue({ userId: "user-uuid" });

      await expect(
        repo.linkProviderAccount("user-uuid", "outlook", "outlook-id-abc")
      ).resolves.toBe("linked");
      expect(providerAccountCreate).toHaveBeenCalledOnce();
    });

    it("rejects a second identity from a provider the account already links", async () => {
      providerAccountFindUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "existing-google-identity" });
      calendarConnectionFindUnique.mockResolvedValue(null);

      await expect(
        repo.linkProviderAccount("user-uuid", "google", "second-google-sub")
      ).resolves.toBe("provider-already-linked");
      expect(providerAccountFindUnique).toHaveBeenLastCalledWith({
        where: { userId_provider: { userId: "user-uuid", provider: "google" } },
        select: { id: true },
      });
      expect(providerAccountCreate).not.toHaveBeenCalled();
    });

    it("reports a conflict when a concurrent link wins the unique constraint", async () => {
      providerAccountFindUnique.mockResolvedValue(null);
      calendarConnectionFindUnique.mockResolvedValue(null);
      providerAccountCreate.mockRejectedValue({ code: "P2002" });

      await expect(repo.linkProviderAccount("user-uuid", "google", "google-sub-123")).resolves.toBe(
        "conflict"
      );
    });
  });

  describe("connectCalendarProvider", () => {
    const seal = (connectionId: string) => `sealed-for-${connectionId}`;

    it("creates a calendar connection and its sealed credential in one serializable transaction", async () => {
      calendarConnectionUpsert.mockResolvedValue({ id: "conn-1", userId: "user-uuid" });

      const result = await repo.connectCalendarProvider(
        "user-uuid",
        "outlook",
        "outlook-id-abc",
        seal
      );

      expect(result).toBe("connected");
      expect(calendarConnectionUpsert).toHaveBeenCalledWith({
        where: {
          provider_providerUserId: { provider: "outlook", providerUserId: "outlook-id-abc" },
        },
        update: {},
        create: {
          provider: "outlook",
          providerUserId: "outlook-id-abc",
          userId: "user-uuid",
        },
        select: { id: true, userId: true },
      });
      expect(calendarCredentialUpsert).toHaveBeenCalledWith({
        where: {
          calendarConnectionId_userId: { calendarConnectionId: "conn-1", userId: "user-uuid" },
        },
        create: {
          calendarConnectionId: "conn-1",
          userId: "user-uuid",
          ciphertext: "sealed-for-conn-1",
        },
        update: { ciphertext: "sealed-for-conn-1" },
        select: { calendarConnectionId: true },
      });
      expect(providerAccountFindUnique).toHaveBeenCalledWith({
        where: {
          provider_providerUserId: { provider: "outlook", providerUserId: "outlook-id-abc" },
        },
        select: { id: true },
      });
      expect(transaction).toHaveBeenCalledOnce();
      expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
        isolationLevel: "Serializable",
      });
      expect(upsert).not.toHaveBeenCalled();
    });

    it("fails the whole transaction when the credential cannot be stored", async () => {
      calendarConnectionUpsert.mockResolvedValue({ id: "conn-1", userId: "user-uuid" });
      calendarCredentialUpsert.mockRejectedValue(new Error("database unavailable"));

      await expect(
        repo.connectCalendarProvider("user-uuid", "google", "google-sub-123", seal)
      ).rejects.toThrow("database unavailable");
      // Both writes ran inside the one transaction, so PostgreSQL rolls back the connection.
      expect(transaction).toHaveBeenCalledOnce();
    });

    it("does not connect a calendar identity already linked to another application account", async () => {
      calendarConnectionUpsert.mockResolvedValue({ id: "conn-1", userId: "other-user-uuid" });

      await expect(
        repo.connectCalendarProvider("user-uuid", "google", "google-sub-123", seal)
      ).resolves.toBe("conflict");
      expect(calendarCredentialUpsert).not.toHaveBeenCalled();
    });

    it("reports a conflict when a unique calendar connection cannot be created", async () => {
      calendarConnectionUpsert.mockRejectedValue({ code: "P2002" });

      await expect(
        repo.connectCalendarProvider("user-uuid", "google", "google-sub-123", seal)
      ).resolves.toBe("conflict");
    });
  });

  describe("disconnectCalendarProvider", () => {
    it("atomically removes the separate calendar connection and cached events", async () => {
      await repo.disconnectCalendarProvider("user-uuid", "google");

      expect(transaction).toHaveBeenCalledOnce();
      expect(calendarConnectionDeleteMany).toHaveBeenCalledWith({
        where: { userId: "user-uuid", provider: "google" },
      });
      expect(deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-uuid", calendarId: "google" },
      });
    });
  });

  describe("getCalendarConnection", () => {
    it("returns an active connection only when it belongs to the authenticated user", async () => {
      calendarConnectionFindUnique.mockResolvedValue({
        id: "connection-uuid",
        provider: "google",
        providerUserId: "google-sub-123",
      });

      await expect(repo.getCalendarConnection("user-uuid", "connection-uuid")).resolves.toEqual({
        id: "connection-uuid",
        provider: "google",
        providerUserId: "google-sub-123",
      });
      expect(calendarConnectionFindUnique).toHaveBeenCalledWith({
        where: { id_userId: { id: "connection-uuid", userId: "user-uuid" } },
        select: { id: true, provider: true, providerUserId: true },
      });
    });
  });

  describe("getCalendarConnectionId", () => {
    it("returns the immutable connection ID for a user's provider", async () => {
      calendarConnectionFindUnique.mockResolvedValue({ id: "connection-uuid" });

      await expect(repo.getCalendarConnectionId("user-uuid", "google")).resolves.toBe(
        "connection-uuid"
      );
      expect(calendarConnectionFindUnique).toHaveBeenCalledWith({
        where: { userId_provider: { userId: "user-uuid", provider: "google" } },
        select: { id: true },
      });
    });
  });

  describe("getCalendarConnections", () => {
    it("returns immutable connection IDs with their provider identities", async () => {
      calendarConnectionFindMany.mockResolvedValue([
        { id: "google-connection", provider: "google", providerUserId: "google-sub-123" },
      ]);

      await expect(repo.getCalendarConnections("user-uuid")).resolves.toEqual([
        { id: "google-connection", provider: "google", providerUserId: "google-sub-123" },
      ]);
      expect(calendarConnectionFindMany).toHaveBeenCalledWith({
        where: { userId: "user-uuid" },
        select: { id: true, provider: true, providerUserId: true },
      });
    });
  });

  describe("getSignInProviders", () => {
    it("lists the providers whose identities sign in to the account, oldest first", async () => {
      findMany.mockResolvedValue([{ provider: "google" }, { provider: "outlook" }]);

      await expect(repo.getSignInProviders("user-uuid")).resolves.toEqual(["google", "outlook"]);
      expect(findMany).toHaveBeenCalledWith({
        where: { userId: "user-uuid" },
        select: { provider: true },
        orderBy: { createdAt: "asc" },
      });
    });
  });

  describe("getConnectedProviders", () => {
    it("returns providers with an explicit calendar connection", async () => {
      calendarConnectionFindMany.mockResolvedValue([
        { provider: "google" },
        { provider: "outlook" },
      ]);
      const result = await repo.getConnectedProviders("user-uuid");
      expect(result).toEqual(["google", "outlook"]);
      expect(calendarConnectionFindMany).toHaveBeenCalledWith({
        where: { userId: "user-uuid" },
        select: { provider: true },
      });
    });

    it("returns an empty array when the user has no connected calendars", async () => {
      calendarConnectionFindMany.mockResolvedValue([]);
      const result = await repo.getConnectedProviders("user-uuid");
      expect(result).toEqual([]);
    });
  });
});
