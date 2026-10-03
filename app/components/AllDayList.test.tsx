import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AllDayList } from "./AllDayList";
import type { AllDayItem } from "../lib/allDay";

const birthday: AllDayItem = {
  key: "google:b",
  title: "Mara's birthday",
  kind: "birthday",
  event: {
    id: "b",
    calendarId: "google",
    title: "Mara's birthday",
    start: "",
    end: "",
    allDay: true,
  },
};

describe("AllDayList", () => {
  it("lists every event as a chip named with its kind", () => {
    const items = Array.from({ length: 7 }, (_, i) => ({
      ...birthday,
      key: `k${i}`,
      title: `B${i}`,
    }));
    render(<AllDayList items={items} onSelect={() => {}} />);
    expect(screen.getAllByRole("button")).toHaveLength(7);
    expect(screen.getByRole("button", { name: "B0 (birthday)" })).toBeTruthy();
  });

  it("opens the chip's event", () => {
    const onSelect = vi.fn();
    render(<AllDayList items={[birthday]} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /Mara's birthday/ }));
    expect(onSelect).toHaveBeenCalledWith(birthday.event);
  });

  it("says when there are none", () => {
    render(<AllDayList items={[]} onSelect={() => {}} />);
    expect(screen.getByText("No all-day events.")).toBeTruthy();
  });
});
