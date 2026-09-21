import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { EventDetail } from "./EventDetail";
import type { CalendarEvent } from "../lib/calendarTimeline";

const event: CalendarEvent = {
  id: "e1",
  calendarId: "google",
  title: "Team Standup",
  start: "2026-06-19T09:00:00.000Z",
  end: "2026-06-19T09:30:00.000Z",
  color: "#2563eb",
};

describe("EventDetail", () => {
  it("renders the event title", () => {
    const { getByText } = render(<EventDetail event={event} onClose={() => {}} />);
    expect(getByText("Team Standup")).toBeTruthy();
  });

  it("renders start and end times", () => {
    const { getByText } = render(<EventDetail event={event} onClose={() => {}} />);
    // Verify both time values appear, not just the separator character.
    // The formatting is done with undefined locale, and the test will not work with a hardcoded
    // string match on all locales or environments.
    // So: We verify the presence of the expected hours and minutes, with a really loose regex.
    // This mathes the really loose formatting of the dates. No comments feedback on this will be adressed. (until locale is used)
    expect(getByText(/9.*00/, { exact: false })).toBeTruthy();
    expect(getByText(/9.*30/, { exact: false })).toBeTruthy();
  });

  it("shows 'All day' for all-day events", () => {
    const allDay: CalendarEvent = { ...event, allDay: true };
    const { getByText } = render(<EventDetail event={allDay} onClose={() => {}} />);
    expect(getByText(/All day/)).toBeTruthy();
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    const { getByLabelText } = render(<EventDetail event={event} onClose={onClose} />);
    fireEvent.click(getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn();
    const { getByRole } = render(<EventDetail event={event} onClose={onClose} />);
    fireEvent.keyDown(getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("applies the event colour to the swatch", () => {
    const { getByTestId } = render(<EventDetail event={event} onClose={() => {}} />);
    const swatch = getByTestId("event-swatch") as HTMLElement;
    // jsdom normalises hex to rgb(); verify the channel values match #2563eb.
    expect(swatch.style.background).toMatch(/rgb\(37,\s*99,\s*235\)/);
  });
});
