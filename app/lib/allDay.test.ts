import { describe, it, expect } from "vitest";
import { allDayForDay, archLayout, ARCH_CAPACITY, ARCH_STEP_DEG, type AllDayItem } from "./allDay";
import { eventWindow } from "../data/eventSlices";
import type { CalendarEvent } from "../data/types";

process.env.TZ = "America/Los_Angeles";

const DAY = eventWindow("day", new Date(2026, 5, 23));

/** An all-day event as the providers store it: UTC midnights of the dates. */
function allDay(id: string, from: string, to: string, extra: Partial<CalendarEvent> = {}) {
  return {
    id,
    calendarId: "google",
    title: id,
    start: `${from}T00:00:00.000Z`,
    end: `${to}T00:00:00.000Z`,
    allDay: true,
    ...extra,
  };
}

describe("allDayForDay", () => {
  it("keeps the shown local day's all-day events and leaves out timed ones", () => {
    const items = allDayForDay(
      [
        allDay("today", "2026-06-23", "2026-06-24"),
        allDay("yesterday", "2026-06-22", "2026-06-23"),
        allDay("trip", "2026-06-20", "2026-06-26"),
        {
          id: "timed",
          calendarId: "google",
          title: "timed",
          start: "2026-06-23T16:00:00Z",
          end: "2026-06-23T17:00:00Z",
        },
      ],
      DAY
    );
    expect(items.map((i) => i.title)).toEqual(["today", "trip"]);
  });

  it("orders birthdays, then time off, then others, each by title", () => {
    const items = allDayForDay(
      [
        allDay("Zed", "2026-06-23", "2026-06-24", { kind: "other" }),
        allDay("Leave", "2026-06-23", "2026-06-24", { kind: "time-off" }),
        allDay("Bea", "2026-06-23", "2026-06-24", { kind: "birthday" }),
        allDay("Ada", "2026-06-23", "2026-06-24", { kind: "birthday" }),
        allDay("Legacy", "2026-06-23", "2026-06-24"),
      ],
      DAY
    );
    expect(items.map((i) => [i.title, i.kind])).toEqual([
      ["Ada", "birthday"],
      ["Bea", "birthday"],
      ["Leave", "time-off"],
      ["Legacy", "other"],
      ["Zed", "other"],
    ]);
  });
});

describe("archLayout", () => {
  const items = (n: number): AllDayItem[] =>
    Array.from({ length: n }, (_, i) => ({
      key: `k${i}`,
      title: `t${i}`,
      kind: "other",
      event: allDay(`t${i}`, "2026-06-23", "2026-06-24"),
    }));

  it("draws nothing for no events", () => {
    expect(archLayout([])).toEqual({ shown: [], overflow: 0 });
  });

  it("puts a single icon at 12 o'clock", () => {
    expect(archLayout(items(1)).shown.map((s) => s.degrees)).toEqual([0]);
  });

  it("spreads three icons symmetrically", () => {
    expect(archLayout(items(3)).shown.map((s) => s.degrees)).toEqual([
      -ARCH_STEP_DEG,
      0,
      ARCH_STEP_DEG,
    ]);
  });

  it("shows exactly as many as fit without a +N icon", () => {
    const layout = archLayout(items(ARCH_CAPACITY));
    expect(layout.shown).toHaveLength(ARCH_CAPACITY);
    expect(layout.overflow).toBe(0);
  });

  it("collapses the rest into a +N icon in the last slot", () => {
    const layout = archLayout(items(8));
    expect(layout.shown).toHaveLength(ARCH_CAPACITY - 1);
    expect(layout.overflow).toBe(8 - (ARCH_CAPACITY - 1));
    expect(layout.overflowDegrees).toBe(2 * ARCH_STEP_DEG);
    expect(layout.shown[0].degrees).toBe(-2 * ARCH_STEP_DEG);
  });
});
