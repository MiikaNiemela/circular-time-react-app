import { describe, it, expect } from "vitest";
import { NEAR_FUTURE_FRESH_FOR_MS, nearFutureRange, shouldRefresh } from "./refreshPolicy";
import type { TimeRange } from "./types";

const NOW = new Date("2026-06-19T12:00:00.000Z");

function range(start: string, end: string): TimeRange {
  return { start, end };
}

describe("shouldRefresh", () => {
  it("refreshes an unknown (never-fetched) period", () => {
    const r = range("2026-06-19T00:00:00.000Z", "2026-06-20T00:00:00.000Z");
    expect(shouldRefresh(r, null, NOW)).toBe(true);
    expect(shouldRefresh(r, undefined, NOW)).toBe(true);
  });

  it("does not auto-refresh a range entirely in the past", () => {
    const r = range("2026-06-17T00:00:00.000Z", "2026-06-18T00:00:00.000Z");
    expect(shouldRefresh(r, "2026-06-18T01:00:00.000Z", NOW)).toBe(false);
  });

  it("treats a range ending exactly at now as past", () => {
    const r = range("2026-06-19T00:00:00.000Z", NOW.toISOString());
    expect(shouldRefresh(r, "2026-06-19T11:00:00.000Z", NOW)).toBe(false);
  });

  it("auto-refreshes a range reaching into the next calendar day", () => {
    // Today: starts before now, ends in the future and within a day.
    const r = range("2026-06-19T00:00:00.000Z", "2026-06-20T00:00:00.000Z");
    expect(shouldRefresh(r, "2026-06-19T11:00:00.000Z", NOW)).toBe(true);
  });

  it("auto-refreshes a fully-future range that begins within a day", () => {
    const r = range("2026-06-19T18:00:00.000Z", "2026-06-21T00:00:00.000Z");
    expect(shouldRefresh(r, "2026-06-19T11:00:00.000Z", NOW)).toBe(true);
  });

  it("does not auto-refresh a far-future range already cached", () => {
    // Starts more than a day out.
    const r = range("2026-06-21T00:00:00.000Z", "2026-06-22T00:00:00.000Z");
    expect(shouldRefresh(r, "2026-06-19T11:00:00.000Z", NOW)).toBe(false);
  });

  it("refreshes a far-future range when never fetched", () => {
    const r = range("2026-06-21T00:00:00.000Z", "2026-06-22T00:00:00.000Z");
    expect(shouldRefresh(r, null, NOW)).toBe(true);
  });

  it("serves a near-future range fetched within the freshness period from the cache", () => {
    const r = range("2026-06-19T00:00:00.000Z", "2026-06-20T00:00:00.000Z");
    const justFresh = new Date(NOW.getTime() - NEAR_FUTURE_FRESH_FOR_MS + 1).toISOString();
    expect(shouldRefresh(r, justFresh, NOW)).toBe(false);
  });

  it("refreshes a near-future range once the freshness period has passed", () => {
    const r = range("2026-06-19T00:00:00.000Z", "2026-06-20T00:00:00.000Z");
    const justStale = new Date(NOW.getTime() - NEAR_FUTURE_FRESH_FOR_MS).toISOString();
    expect(shouldRefresh(r, justStale, NOW)).toBe(true);
  });
});

describe("nearFutureRange", () => {
  it("spans from now to one day ahead", () => {
    expect(nearFutureRange(NOW)).toEqual({
      start: "2026-06-19T12:00:00.000Z",
      end: "2026-06-20T12:00:00.000Z",
    });
  });
});
