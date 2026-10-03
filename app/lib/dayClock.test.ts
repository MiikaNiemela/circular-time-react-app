import { describe, it, expect } from "vitest";
import { angleInWindow, dayClock } from "./dayClock";
import { eventSlicesForView, eventWindow } from "../data/eventSlices";

// Europe/Helsinki changes to summer time on 2026-03-29 (23 h) and back on
// 2026-10-25 (25 h).
process.env.TZ = "Europe/Helsinki";

/** Local wall-clock time in the test time zone. */
const local = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi);

/** Degrees the event ring leaves empty before an event that starts at `start`. */
function sliceStartDegrees(start: Date, reference: Date): number {
  const ring = eventSlicesForView({
    events: [
      {
        id: "e",
        calendarId: "google",
        title: "probe",
        start: start.toISOString(),
        end: new Date(start.getTime() + 60_000).toISOString(),
      },
    ],
    fetchedRange: eventWindow("day", reference),
    view: "day",
    now: reference,
  });
  return ring.slices[0].eventId ? 0 : ring.slices[0].degrees;
}

describe("angleInWindow", () => {
  const day = eventWindow("day", local(2026, 6, 23));

  it.each([
    [0, 0, 0],
    [6, 0, 90],
    [12, 0, 180],
    [18, 0, 270],
    [14, 20, (14 + 20 / 60) * 15],
  ])("puts %i:%i at %f° on an ordinary day", (h, mi, degrees) => {
    expect(angleInWindow(local(2026, 6, 23, h, mi), day)).toBeCloseTo(degrees, 6);
  });

  it("clamps instants outside the window", () => {
    expect(angleInWindow(local(2026, 6, 22, 23), day)).toBe(0);
    expect(angleInWindow(local(2026, 6, 24, 1), day)).toBe(360);
  });

  it("spreads a 23-hour spring-forward day over the full circle", () => {
    const spring = eventWindow("day", local(2026, 3, 29));
    // 12:00 local is 11 elapsed hours into a 23-hour day.
    expect(angleInWindow(local(2026, 3, 29, 12), spring)).toBeCloseTo((11 / 23) * 360, 6);
  });

  it("spreads a 25-hour fall-back day over the full circle", () => {
    const autumn = eventWindow("day", local(2026, 10, 25));
    // 12:00 local is 13 elapsed hours into a 25-hour day.
    expect(angleInWindow(local(2026, 10, 25, 12), autumn)).toBeCloseTo((13 / 25) * 360, 6);
  });

  it.each([
    ["an ordinary day", local(2026, 6, 23, 14, 20)],
    ["the spring-forward day", local(2026, 3, 29, 12)],
    ["the fall-back day", local(2026, 10, 25, 12)],
  ])("matches where an event slice starts on %s", (_name, instant) => {
    const angle = angleInWindow(instant, eventWindow("day", instant));
    expect(angle).toBeCloseTo(sliceStartDegrees(instant, instant), 6);
  });
});

describe("dayClock", () => {
  it("shows the time and the date with a hand today", () => {
    const now = local(2026, 6, 23, 14, 5);
    const clock = dayClock("day", local(2026, 6, 23), now, "en-GB");
    expect(clock).toEqual({
      handDegrees: angleInWindow(now, eventWindow("day", now)),
      primary: "14:05",
      secondary: "Tue 23 Jun",
    });
  });

  it("uses 24-hour time after midnight", () => {
    const now = local(2026, 6, 23, 0, 7);
    expect(dayClock("day", now, now, "en-GB")?.primary).toBe("00:07");
  });

  it("shows only the date and no hand on another day", () => {
    const clock = dayClock("day", local(2026, 6, 24), local(2026, 6, 23, 14), "en-GB");
    expect(clock).toEqual({ primary: "24", secondary: "Wed June 2026" });
    expect(clock).not.toHaveProperty("handDegrees");
  });

  it.each(["week", "month", "year"] as const)("returns nothing for the %s view", (view) => {
    expect(dayClock(view, local(2026, 6, 23), local(2026, 6, 23, 14))).toBeNull();
  });
});
