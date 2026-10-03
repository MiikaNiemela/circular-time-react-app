import { describe, it, expect } from "vitest";
import { dayAgenda } from "./dayAgenda";
import { eventWindow } from "../data/eventSlices";
import type { CalendarEvent } from "../data/types";

process.env.TZ = "Europe/Helsinki";

const at = (d: number, h: number, m = 0) => new Date(2026, 5, d, h, m).toISOString();
const DAY = eventWindow("day", new Date(2026, 5, 23));

function event(id: string, start: string, end: string, extra: Partial<CalendarEvent> = {}) {
  return { id, calendarId: "google", title: id, start, end, ...extra };
}

describe("dayAgenda", () => {
  it("lists the day's timed events by start, then end, then key", () => {
    const items = dayAgenda(
      [
        event("lunch", at(23, 12), at(23, 13)),
        event("b-standup", at(23, 9), at(23, 9, 15)),
        event("a-standup", at(23, 9), at(23, 9, 15)),
        event("long", at(23, 9), at(23, 11)),
        event("tomorrow", at(24, 9), at(24, 10)),
        event("holiday", at(23, 0), at(24, 0), { allDay: true }),
      ],
      DAY,
      null,
      "en-GB"
    );
    expect(items.map((i) => [i.time, i.event.id])).toEqual([
      ["09:00", "a-standup"],
      ["09:00", "b-standup"],
      ["09:00", "long"],
      ["12:00", "lunch"],
    ]);
  });

  it("clamps events that cross the day's edges and marks them", () => {
    const [overnight, late] = dayAgenda(
      [event("overnight", at(22, 22), at(23, 2)), event("late", at(23, 23), at(24, 1))],
      DAY,
      null,
      "en-GB"
    );
    expect(overnight).toMatchObject({ time: "00:00", startedEarlier: true, endsLater: false });
    expect(late).toMatchObject({ time: "23:00", startedEarlier: false, endsLater: true });
  });

  it("marks past events and the next event today", () => {
    const items = dayAgenda(
      [
        event("done", at(23, 8), at(23, 9)),
        event("ongoing", at(23, 14), at(23, 15)),
        event("next", at(23, 16), at(23, 17)),
        event("later", at(23, 18), at(23, 19)),
      ],
      DAY,
      new Date(2026, 5, 23, 14, 20)
    );
    expect(items.map((i) => [i.event.id, i.past, i.upNext])).toEqual([
      ["done", true, false],
      ["ongoing", false, false],
      ["next", false, true],
      ["later", false, false],
    ]);
  });

  it("marks nothing as past or next on another day", () => {
    const items = dayAgenda([event("x", at(23, 8), at(23, 9))], DAY, null);
    expect(items[0]).toMatchObject({ past: false, upNext: false });
  });

  it("has no next event once the day's last event has started", () => {
    const items = dayAgenda(
      [event("last", at(23, 14), at(23, 15))],
      DAY,
      new Date(2026, 5, 23, 14, 30)
    );
    expect(items.some((i) => i.upNext)).toBe(false);
  });

  it("uses the slice colour", () => {
    const [coloured, plain] = dayAgenda(
      [event("a", at(23, 8), at(23, 9), { color: "#2563eb" }), event("b", at(23, 10), at(23, 11))],
      DAY,
      null
    );
    expect(coloured.color).toBe("#2563eb");
    expect(plain.color).toBe("#f59e0b");
  });
});
