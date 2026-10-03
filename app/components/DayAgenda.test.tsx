import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DayAgenda } from "./DayAgenda";
import type { AgendaItem } from "../lib/dayAgenda";

function item(id: string, overrides: Partial<AgendaItem> = {}): AgendaItem {
  return {
    key: `google:${id}`,
    event: { id, calendarId: "google", title: id, start: "", end: "" },
    time: "09:00",
    color: "#2563eb",
    startedEarlier: false,
    endsLater: false,
    past: false,
    upNext: false,
    ...overrides,
  };
}

const name = (id: string) => (id === "google" ? "Google Calendar" : id);

describe("DayAgenda", () => {
  it("shows time, title and calendar name per event", () => {
    render(<DayAgenda items={[item("Standup")]} calendarName={name} onSelect={() => {}} />);
    const row = screen.getByRole("button", { name: /Standup/ });
    expect(row.textContent).toBe("09:00StandupGoogle Calendar");
  });

  it("marks the next event and boundary-crossing events", () => {
    render(
      <DayAgenda
        items={[
          item("Overnight", { time: "00:00", startedEarlier: true }),
          item("Review", { upNext: true, endsLater: true }),
        ]}
        calendarName={name}
        onSelect={() => {}}
      />
    );
    expect(screen.getByRole("button", { name: /Overnight/ }).textContent).toContain(
      "started earlier · Google Calendar"
    );
    const next = screen.getByRole("button", { name: /Review/ });
    expect(next.textContent).toContain("Up next");
    expect(next.textContent).toContain("ends later");
  });

  it("selects the row's event", () => {
    const onSelect = vi.fn();
    const it1 = item("Lunch");
    render(<DayAgenda items={[it1]} calendarName={name} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /Lunch/ }));
    expect(onSelect).toHaveBeenCalledWith(it1.event);
  });

  it("offers to expand past events and collapse them again", () => {
    render(
      <DayAgenda
        items={[item("Done", { past: true }), item("Later")]}
        calendarName={name}
        onSelect={() => {}}
      />
    );
    const toggle = screen.getByRole("button", { name: "Show full day (1 earlier)" });
    expect(screen.getByRole("list").className).toMatch(/collapsed/);
    fireEvent.click(toggle);
    expect(screen.getByRole("list").className).not.toMatch(/collapsed/);
    expect(screen.getByRole("button", { name: "Show upcoming only" })).toBeTruthy();
  });

  it("has no expand control when nothing is past", () => {
    render(<DayAgenda items={[item("Later")]} calendarName={name} onSelect={() => {}} />);
    expect(screen.queryByRole("button", { name: /Show full day/ })).toBeNull();
  });

  it("says when the day has no timed events", () => {
    render(<DayAgenda items={[]} calendarName={name} onSelect={() => {}} />);
    expect(screen.getByText("No timed events.")).toBeTruthy();
  });
});
