import { describe, it, expect, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { PrismaStreamRepository } from "./prismaStreamRepository.server";

/** A client with no unassigned connections and one stored stream. */
function settledClient() {
  const transaction = vi.fn();
  const db = {
    calendarConnection: { findMany: vi.fn(async () => []) },
    stream: {
      findMany: vi.fn(async () => [
        {
          id: "s1",
          name: "Google Calendar",
          color: "blue",
          visible: true,
          sources: [{ calendarConnectionId: "c1", calendarConnection: { createdAt: new Date(0) } }],
        },
      ]),
    },
    $transaction: transaction,
  };
  return { db, transaction };
}

describe("PrismaStreamRepository.ensureDefaultStreams", () => {
  it("reads without a transaction or write when every connection has a stream", async () => {
    const { db, transaction } = settledClient();
    const repo = new PrismaStreamRepository(db as unknown as PrismaClient);

    expect(await repo.ensureDefaultStreams("u1")).toEqual([
      {
        id: "s1",
        name: "Google Calendar",
        color: "blue",
        visible: true,
        calendarConnectionIds: ["c1"],
      },
    ]);
    expect(transaction).not.toHaveBeenCalled();
  });

  it.each(["P2002", "P2034"])(
    "retries a lost %s race and returns the winner's streams",
    async (code) => {
      const { db } = settledClient();
      db.calendarConnection.findMany = vi.fn(async () => [
        { id: "c1", provider: "google" },
      ]) as never;
      const winner = [
        {
          id: "s1",
          name: "Google Calendar",
          color: "blue",
          visible: true,
          calendarConnectionIds: [],
        },
      ];
      let calls = 0;
      db.$transaction = vi.fn(async () => {
        calls += 1;
        if (calls === 1) throw Object.assign(new Error("race"), { code });
        return winner;
      });
      const repo = new PrismaStreamRepository(db as unknown as PrismaClient);

      expect(await repo.ensureDefaultStreams("u1")).toBe(winner);
      expect(calls).toBe(2);
    }
  );

  it("gives up after eight lost races", async () => {
    const { db } = settledClient();
    db.calendarConnection.findMany = vi.fn(async () => [{ id: "c1", provider: "google" }]) as never;
    db.$transaction = vi.fn(async () => {
      throw Object.assign(new Error("race"), { code: "P2002" });
    });
    const repo = new PrismaStreamRepository(db as unknown as PrismaClient);

    await expect(repo.ensureDefaultStreams("u1")).rejects.toThrow("race");
    expect(db.$transaction).toHaveBeenCalledTimes(8);
  });

  it("does not retry other errors", async () => {
    const { db } = settledClient();
    db.calendarConnection.findMany = vi.fn(async () => [{ id: "c1", provider: "google" }]) as never;
    db.$transaction = vi.fn(async () => {
      throw Object.assign(new Error("boom"), { code: "P1001" });
    });
    const repo = new PrismaStreamRepository(db as unknown as PrismaClient);

    await expect(repo.ensureDefaultStreams("u1")).rejects.toThrow("boom");
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });
});
