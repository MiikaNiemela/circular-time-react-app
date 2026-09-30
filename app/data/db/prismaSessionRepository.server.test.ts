import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { PrismaSessionRepository, hashSessionToken } from "./prismaSessionRepository.server";

describe("PrismaSessionRepository", () => {
  let create: ReturnType<typeof vi.fn>;
  let findUnique: ReturnType<typeof vi.fn>;
  let deleteMany: ReturnType<typeof vi.fn>;
  let repo: PrismaSessionRepository;
  const now = new Date("2026-10-01T00:00:00Z");

  beforeEach(() => {
    create = vi.fn().mockResolvedValue({ id: "hash" });
    findUnique = vi.fn();
    deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const db = { session: { create, findUnique, deleteMany } } as unknown as PrismaClient;
    repo = new PrismaSessionRepository(db);
  });

  it("creates a 256-bit random token and stores only its hash", async () => {
    const expiresAt = new Date("2026-10-31T00:00:00Z");

    const token = await repo.create("user-uuid", expiresAt);

    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(create).toHaveBeenCalledWith({
      data: { id: hashSessionToken(token), userId: "user-uuid", expiresAt },
      select: { id: true },
    });
    expect(JSON.stringify(create.mock.calls)).not.toContain(token);
  });

  it("issues a different token for every session", async () => {
    const a = await repo.create("user-uuid", now);
    const b = await repo.create("user-uuid", now);

    expect(a).not.toBe(b);
  });

  it("resolves an unexpired session to its user by token hash", async () => {
    findUnique.mockResolvedValue({ userId: "user-uuid", expiresAt: new Date(now.getTime() + 1) });

    await expect(repo.findUserId("token", now)).resolves.toBe("user-uuid");
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: hashSessionToken("token") },
      select: { userId: true, expiresAt: true },
    });
  });

  it("returns null for an unknown or revoked session", async () => {
    findUnique.mockResolvedValue(null);

    await expect(repo.findUserId("token", now)).resolves.toBeNull();
  });

  it("deletes and rejects an expired session", async () => {
    findUnique.mockResolvedValue({ userId: "user-uuid", expiresAt: now });

    await expect(repo.findUserId("token", now)).resolves.toBeNull();
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: hashSessionToken("token") } });
  });

  it("revokes only the session row", async () => {
    await repo.revoke("token");

    expect(deleteMany).toHaveBeenCalledWith({ where: { id: hashSessionToken("token") } });
  });
});
