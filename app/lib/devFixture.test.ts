import { describe, it, expect } from "vitest";
import { getDevFixtureCalendars } from "./devFixture";

// import.meta.env.PROD is false in Vitest (test mode), so fixture returns data.
const reference = new Date("2026-06-20T12:00:00");

describe("getDevFixtureCalendars", () => {
  it("returns two calendars in dev/test mode", () => {
    expect(getDevFixtureCalendars(reference)).toHaveLength(2);
  });

  it("each entry has calendarId, a non-empty events array, and a fetchedRange", () => {
    for (const cal of getDevFixtureCalendars(reference)) {
      expect(cal.calendarId).toBeTruthy();
      expect(cal.events.length).toBeGreaterThan(0);
      expect(cal.fetchedRange).not.toBeNull();
    }
  });

  it("each event has the calendarId, title, start, end, and color fields", () => {
    for (const cal of getDevFixtureCalendars(reference)) {
      for (const evt of cal.events) {
        expect(evt.calendarId).toBe(cal.calendarId);
        expect(evt.id).toBeTruthy();
        expect(evt.title).toBeTruthy();
        expect(evt.start).toBeTruthy();
        expect(evt.end).toBeTruthy();
        expect(evt.color).toMatch(/^#/);
      }
    }
  });

  describe("day view (default)", () => {
    it("all events fall within the local calendar day of reference", () => {
      const dayStart = new Date(reference);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(reference);
      dayEnd.setDate(dayEnd.getDate() + 1);
      dayEnd.setHours(0, 0, 0, 0);

      for (const cal of getDevFixtureCalendars(reference, "day")) {
        for (const evt of cal.events) {
          const start = new Date(evt.start).getTime();
          const end = new Date(evt.end).getTime();
          expect(start).toBeGreaterThanOrEqual(dayStart.getTime());
          expect(end).toBeLessThanOrEqual(dayEnd.getTime());
        }
      }
    });

    it("fetchedRange covers the full local day of reference", () => {
      const dayStart = new Date(reference);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(reference);
      dayEnd.setDate(dayEnd.getDate() + 1);
      dayEnd.setHours(0, 0, 0, 0);

      for (const cal of getDevFixtureCalendars(reference, "day")) {
        expect(new Date(cal.fetchedRange!.start).getTime()).toBeLessThanOrEqual(dayStart.getTime());
        expect(new Date(cal.fetchedRange!.end).getTime()).toBeGreaterThanOrEqual(dayEnd.getTime());
      }
    });
  });

  describe("week view", () => {
    it("fetchedRange spans a full Mon–Sun week", () => {
      for (const cal of getDevFixtureCalendars(reference, "week")) {
        const start = new Date(cal.fetchedRange!.start);
        const end = new Date(cal.fetchedRange!.end);
        const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        expect(days).toBe(7);
      }
    });

    it("generates more events than day view", () => {
      const dayCount = getDevFixtureCalendars(reference, "day")[0].events.length;
      const weekCount = getDevFixtureCalendars(reference, "week")[0].events.length;
      expect(weekCount).toBeGreaterThan(dayCount);
    });

    it("all events fall within the fetched range", () => {
      for (const cal of getDevFixtureCalendars(reference, "week")) {
        const rangeStart = new Date(cal.fetchedRange!.start).getTime();
        const rangeEnd = new Date(cal.fetchedRange!.end).getTime();
        for (const evt of cal.events) {
          expect(new Date(evt.start).getTime()).toBeGreaterThanOrEqual(rangeStart);
          expect(new Date(evt.end).getTime()).toBeLessThanOrEqual(rangeEnd);
        }
      }
    });
  });

  describe("month view", () => {
    it("fetchedRange spans the full calendar month", () => {
      for (const cal of getDevFixtureCalendars(reference, "month")) {
        const start = new Date(cal.fetchedRange!.start);
        const end = new Date(cal.fetchedRange!.end);
        expect(start.getDate()).toBe(1);
        expect(end.getDate()).toBe(1);
        expect(end.getMonth()).toBe((start.getMonth() + 1) % 12);
      }
    });

    it("generates more events than week view", () => {
      const weekCount = getDevFixtureCalendars(reference, "week")[0].events.length;
      const monthCount = getDevFixtureCalendars(reference, "month")[0].events.length;
      expect(monthCount).toBeGreaterThan(weekCount);
    });
  });

  describe("two calendars have different colors", () => {
    it("google and outlook events differ in color for the same slot", () => {
      const [google, outlook] = getDevFixtureCalendars(reference, "day");
      expect(google.events[0].color).not.toBe(outlook.events[0].color);
    });
  });
});
