import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CalendarLegend, calendarLabel } from "./CalendarLegend";

describe("CalendarLegend", () => {
  it("lists calendars in ring order with their ring position", () => {
    render(
      <CalendarLegend
        items={[
          { id: "google", label: "Google Calendar" },
          { id: "work", label: "Work" },
          { id: "outlook", label: "Outlook" },
        ]}
      />
    );
    const rows = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(rows).toEqual(["Google CalendarOuter ring", "WorkRing 2", "OutlookInner ring"]);
  });

  it("names a single calendar's ring without a position", () => {
    render(<CalendarLegend items={[{ id: "google", label: "Google Calendar" }]} />);
    expect(screen.getByRole("listitem").textContent).toBe("Google CalendarRing");
  });
});

describe("calendarLabel", () => {
  it.each([
    ["google", "Google Calendar"],
    ["outlook", "Outlook"],
    ["dev-google", "Google Calendar (sample)"],
    ["something", "something"],
  ])("labels %s as %s", (id, label) => {
    expect(calendarLabel(id)).toBe(label);
  });
});
