import { describe, it, expect } from "vitest";
import { blankState, type BlankStateInput } from "./blankState";
import type { CalendarEventData } from "./calendarTimeline";

const WINDOW = { start: "2026-10-04T00:00:00.000Z", end: "2026-10-05T00:00:00.000Z" };
const EVENT = {
  id: "e",
  calendarId: "google",
  title: "Standup",
  start: "2026-10-04T09:00:00.000Z",
  end: "2026-10-04T09:30:00.000Z",
};

const cal = (calendarId: string, events = [] as CalendarEventData["events"], cached = true) => ({
  calendarId,
  events,
  fetchedRange: cached ? WINDOW : null,
});

const input = (over: Partial<BlankStateInput>): BlankStateInput => ({
  connectedCount: 1,
  visible: [cal("google")],
  failures: [],
  window: WINDOW,
  ...over,
});

describe("blankState", () => {
  it("explains an account with no calendars first", () => {
    expect(
      blankState(
        input({
          connectedCount: 0,
          visible: [],
          failures: [{ calendarId: "google", reason: "unavailable" }],
        })
      )
    ).toEqual({ kind: "no-sources" });
  });

  it("explains that every calendar is hidden before any failure", () => {
    expect(
      blankState(
        input({
          connectedCount: 2,
          visible: [],
          failures: [{ calendarId: "google", reason: "reconnect-required" }],
        })
      )
    ).toEqual({ kind: "all-hidden" });
  });

  it("asks to reconnect a visible calendar, even when others have events", () => {
    expect(
      blankState(
        input({
          connectedCount: 2,
          visible: [cal("google", [EVENT]), cal("outlook", [], false)],
          failures: [
            { calendarId: "outlook", reason: "reconnect-required" },
            { calendarId: "google", reason: "unavailable" },
          ],
        })
      )
    ).toEqual({ kind: "reconnect", calendarIds: ["outlook"] });
  });

  it("ignores failures of hidden calendars", () => {
    expect(
      blankState(
        input({
          connectedCount: 2,
          visible: [cal("google")],
          failures: [{ calendarId: "outlook", reason: "reconnect-required" }],
        })
      )
    ).toEqual({ kind: "no-events" });
  });

  it("explains a blank period when a provider was unavailable and nothing is cached", () => {
    expect(
      blankState(
        input({
          visible: [cal("google", [], false)],
          failures: [{ calendarId: "google", reason: "unavailable" }],
        })
      )
    ).toEqual({ kind: "unavailable", calendarIds: ["google"] });
  });

  it("treats an unavailable provider with a cached period as simply no events", () => {
    expect(
      blankState(input({ failures: [{ calendarId: "google", reason: "unavailable" }] }))
    ).toEqual({ kind: "no-events" });
  });

  it("says nothing when the period has events, despite an unavailable provider", () => {
    expect(
      blankState(
        input({
          visible: [cal("google", [EVENT], false)],
          failures: [{ calendarId: "google", reason: "unavailable" }],
        })
      )
    ).toBeNull();
  });

  it("counts only events inside the shown period", () => {
    const tomorrow = {
      ...EVENT,
      start: "2026-10-05T09:00:00.000Z",
      end: "2026-10-05T10:00:00.000Z",
    };
    expect(blankState(input({ visible: [cal("google", [tomorrow])] }))).toEqual({
      kind: "no-events",
    });
  });

  it("says the period has no events when everything was read", () => {
    expect(blankState(input({}))).toEqual({ kind: "no-events" });
  });
});
