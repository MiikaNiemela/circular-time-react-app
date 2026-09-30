import { describe, it, expect, vi, beforeEach } from "vitest";
import { PrismaEventCacheRepository } from "./prismaEventCacheRepository.server";
import type { PrismaClient } from "@prisma/client";

describe("PrismaEventCacheRepository", () => {
  let findFirst: ReturnType<typeof vi.fn>;
  let upsert: ReturnType<typeof vi.fn>;
  let repo: PrismaEventCacheRepository;

  const RANGE = { start: "2026-01-01T00:00:00Z", end: "2026-02-01T00:00:00Z" };
  const EVENTS = [
    {
      id: "e1",
      calendarId: "google",
      title: "Meeting",
      start: "2026-01-10T09:00:00Z",
      end: "2026-01-10T10:00:00Z",
    },
  ];
  const FETCHED_AT = new Date("2026-01-01T12:00:00Z");

  beforeEach(() => {
    findFirst = vi.fn();
    upsert = vi.fn();
    const db = {
      cachedEventRange: { findFirst, upsert },
    } as unknown as PrismaClient;
    repo = new PrismaEventCacheRepository(db);
  });

  describe("get", () => {
    it("returns null when no record exists", async () => {
      findFirst.mockResolvedValue(null);
      const result = await repo.get("user-1", "google", RANGE);
      expect(result).toBeNull();
    });

    it("returns a CacheEntry when a record exists", async () => {
      findFirst.mockResolvedValue({
        calendarId: "google",
        rangeStart: RANGE.start,
        rangeEnd: RANGE.end,
        eventsJson: JSON.stringify(EVENTS),
        fetchedAt: FETCHED_AT,
      });
      const result = await repo.get("user-1", "google", RANGE);
      expect(result).toEqual({
        calendarId: "google",
        range: RANGE,
        events: EVENTS,
        fetchedAt: FETCHED_AT.toISOString(),
      });
    });

    it("queries by the exact userId, calendarId, and range boundaries", async () => {
      findFirst.mockResolvedValue(null);
      await repo.get("user-1", "outlook", RANGE);
      expect(findFirst).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          calendarId: "outlook",
          rangeStart: RANGE.start,
          rangeEnd: RANGE.end,
          calendarConnection: { isNot: null },
        },
      });
    });
  });

  describe("set", () => {
    it("upserts with correct fields", async () => {
      upsert.mockResolvedValue({});
      const entry = {
        calendarId: "google",
        range: RANGE,
        events: EVENTS,
        fetchedAt: FETCHED_AT.toISOString(),
      };
      await repo.set("user-1", "connection-abc", entry);
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_calendarId_rangeStart_rangeEnd: {
              userId: "user-1",
              calendarId: "google",
              rangeStart: RANGE.start,
              rangeEnd: RANGE.end,
            },
          },
          update: expect.objectContaining({
            eventsJson: JSON.stringify(EVENTS),
            calendarConnection: {
              connect: { id_userId: { id: "connection-abc", userId: "user-1" } },
            },
          }),
          create: expect.objectContaining({
            user: { connect: { id: "user-1" } },
            calendarId: "google",
            eventsJson: JSON.stringify(EVENTS),
            calendarConnection: {
              connect: { id_userId: { id: "connection-abc", userId: "user-1" } },
            },
          }),
        })
      );
    });
  });
});
