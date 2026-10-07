/**
 * Stream repository against a real PostgreSQL: constraints, defaults, races
 * and every change. Runs only when TEST_DATABASE_URL points at a disposable
 * database with the migrations applied (`npm run test:db`); CI's unit
 * projects skip it.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaStreamRepository } from "./prismaStreamRepository.server";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("PrismaStreamRepository on PostgreSQL", () => {
  let db: PrismaClient;
  let repo: PrismaStreamRepository;

  beforeAll(() => {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
    repo = new PrismaStreamRepository(db);
  });
  afterAll(() => db.$disconnect());

  beforeEach(async () => {
    await db.$executeRawUnsafe('TRUNCATE "User" CASCADE');
    await db.user.createMany({ data: [{ id: "u1" }, { id: "u2" }] });
    await db.calendarConnection.createMany({
      data: [
        {
          id: "c-google",
          provider: "google",
          providerUserId: "g",
          userId: "u1",
          createdAt: new Date(1000),
        },
        {
          id: "c-outlook",
          provider: "outlook",
          providerUserId: "o",
          userId: "u1",
          createdAt: new Date(2000),
        },
        {
          id: "c-other",
          provider: "google",
          providerUserId: "g2",
          userId: "u2",
          createdAt: new Date(500),
        },
      ],
    });
  });

  it("creates one default stream per connection, oldest first, then reads without writing", async () => {
    const streams = await repo.ensureDefaultStreams("u1");
    expect(streams.map((s) => [s.name, s.color, s.visible, s.calendarConnectionIds])).toEqual([
      ["Google Calendar", "blue", true, ["c-google"]],
      ["Outlook", "teal", true, ["c-outlook"]],
    ]);
    const before = await db.stream.findMany({ orderBy: { id: "asc" } });
    expect(await repo.ensureDefaultStreams("u1")).toEqual(streams);
    expect(await db.stream.findMany({ orderBy: { id: "asc" } })).toEqual(before);
  });

  it("gives exactly one stream per connection when first loads race", async () => {
    const results = await Promise.all(
      Array.from({ length: 4 }, () => repo.ensureDefaultStreams("u1"))
    );
    for (const r of results)
      expect(r.map((s) => s.calendarConnectionIds)).toEqual([["c-google"], ["c-outlook"]]);
    expect(await db.stream.count({ where: { userId: "u1" } })).toBe(2);
    expect(await db.streamSource.count({ where: { userId: "u1" } })).toBe(2);
  });

  it("refuses a source joining one account's stream to another account's calendar", async () => {
    const [stream] = await repo.ensureDefaultStreams("u1");
    await expect(
      db.streamSource.create({
        data: {
          userId: "u1",
          streamId: stream.id,
          kind: "calendar",
          calendarConnectionId: "c-other",
        },
      })
    ).rejects.toThrow();
  });

  it.each([
    ["a calendar source without a calendar", { kind: "calendar" }],
    ["an unknown kind", { kind: "tracker" }],
  ])("refuses %s", async (_name, extra) => {
    const [stream] = await repo.ensureDefaultStreams("u1");
    await expect(
      db.streamSource.create({ data: { userId: "u1", streamId: stream.id, ...extra } })
    ).rejects.toThrow();
  });

  it("keeps a stream when its calendar is disconnected, without sources", async () => {
    await repo.ensureDefaultStreams("u1");
    await db.calendarConnection.delete({ where: { id: "c-google" } });
    const streams = await repo.ensureDefaultStreams("u1");
    expect(streams.map((s) => [s.name, s.calendarConnectionIds])).toEqual([
      ["Google Calendar", []],
      ["Outlook", ["c-outlook"]],
    ]);
  });

  describe("applyStreamChange", () => {
    it("renames, hides and moves a stream", async () => {
      const [google, outlook] = await repo.ensureDefaultStreams("u1");
      expect(
        await repo.applyStreamChange("u1", { intent: "rename", streamId: google.id, name: "Work" })
      ).toBe("ok");
      expect(
        await repo.applyStreamChange("u1", {
          intent: "set-visible",
          streamId: outlook.id,
          visible: false,
        })
      ).toBe("ok");
      expect(
        await repo.applyStreamChange("u1", {
          intent: "move",
          streamId: outlook.id,
          direction: "up",
        })
      ).toBe("ok");
      const streams = await repo.ensureDefaultStreams("u1");
      expect(streams.map((s) => [s.name, s.visible])).toEqual([
        ["Outlook", false],
        ["Work", true],
      ]);
      const positions = await db.stream.findMany({
        where: { userId: "u1" },
        orderBy: { position: "asc" },
      });
      expect(positions.map((s) => s.position)).toEqual([0, 1]);
    });

    it("keeps positions dense and complete under concurrent moves", async () => {
      await db.calendarConnection
        .create({
          data: {
            id: "c-3",
            provider: "google",
            providerUserId: "g3",
            userId: "u1",
            createdAt: new Date(3000),
          },
        })
        .catch(() => undefined);
      const streams = await repo.ensureDefaultStreams("u1");
      await Promise.all(
        streams.flatMap((s) => [
          repo.applyStreamChange("u1", { intent: "move", streamId: s.id, direction: "down" }),
          repo.applyStreamChange("u1", { intent: "move", streamId: s.id, direction: "up" }),
        ])
      );
      const rows = await db.stream.findMany({
        where: { userId: "u1" },
        orderBy: { position: "asc" },
      });
      expect(rows.map((s) => s.position)).toEqual(rows.map((_, i) => i));
      expect(new Set(rows.map((s) => s.id))).toEqual(new Set(streams.map((s) => s.id)));
    });

    it("moves a calendar into another stream, or into a new one at the end", async () => {
      const [google, outlook] = await repo.ensureDefaultStreams("u1");
      expect(
        await repo.applyStreamChange("u1", {
          intent: "assign",
          calendarConnectionId: "c-outlook",
          streamId: google.id,
        })
      ).toBe("ok");
      let streams = await repo.ensureDefaultStreams("u1");
      expect(streams.map((s) => [s.id, s.calendarConnectionIds])).toEqual([
        [google.id, ["c-google", "c-outlook"]],
        [outlook.id, []],
      ]);
      expect(
        await repo.applyStreamChange("u1", {
          intent: "assign",
          calendarConnectionId: "c-google",
          streamId: null,
        })
      ).toBe("ok");
      streams = await repo.ensureDefaultStreams("u1");
      expect(streams.map((s) => s.calendarConnectionIds)).toEqual([
        ["c-outlook"],
        [],
        ["c-google"],
      ]);
    });

    it("deletes only an empty stream, and renumbers the rest", async () => {
      const [google, outlook] = await repo.ensureDefaultStreams("u1");
      expect(await repo.applyStreamChange("u1", { intent: "delete", streamId: google.id })).toBe(
        "not-empty"
      );
      await repo.applyStreamChange("u1", {
        intent: "assign",
        calendarConnectionId: "c-google",
        streamId: outlook.id,
      });
      expect(await repo.applyStreamChange("u1", { intent: "delete", streamId: google.id })).toBe(
        "ok"
      );
      const rows = await db.stream.findMany({ where: { userId: "u1" } });
      expect(rows.map((s) => [s.id, s.position])).toEqual([[outlook.id, 0]]);
    });

    it("never touches another account's streams or calendars", async () => {
      const [mine] = await repo.ensureDefaultStreams("u1");
      const [theirs] = await repo.ensureDefaultStreams("u2");
      expect(
        await repo.applyStreamChange("u1", { intent: "rename", streamId: theirs.id, name: "x" })
      ).toBe("not-found");
      expect(await repo.applyStreamChange("u1", { intent: "delete", streamId: theirs.id })).toBe(
        "not-found"
      );
      expect(
        await repo.applyStreamChange("u1", {
          intent: "assign",
          calendarConnectionId: "c-other",
          streamId: mine.id,
        })
      ).toBe("not-found");
      expect(
        await repo.applyStreamChange("u1", {
          intent: "assign",
          calendarConnectionId: "c-google",
          streamId: theirs.id,
        })
      ).toBe("not-found");
      expect((await repo.ensureDefaultStreams("u2"))[0].name).toBe("Google Calendar");
    });
  });
});
