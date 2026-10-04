import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AllDayArch } from "./AllDayArch";
import type { AllDayItem } from "../lib/allDay";
import type { AllDayKind } from "../data/types";

function item(title: string, kind: AllDayKind): AllDayItem {
  return {
    key: `google:${title}`,
    title,
    kind,
    event: { id: title, calendarId: "google", title, start: "", end: "", allDay: true, kind },
  };
}

describe("AllDayArch", () => {
  it("keeps its space but draws nothing, hidden, without all-day events", () => {
    const { container } = render(<AllDayArch items={[]} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("data-all-day-arch")).toBe("empty");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("viewBox")).toBe("0 0 100 18");
    expect(svg.childElementCount).toBe(0);
  });

  it("draws one icon per event with its kind, and names them all", () => {
    render(
      <AllDayArch
        items={[
          item("Mara's birthday", "birthday"),
          item("Annual leave", "time-off"),
          item("Midsummer", "other"),
        ]}
      />
    );
    const arch = screen.getByRole("img");
    expect(arch.getAttribute("aria-label")).toBe(
      "All day: Mara's birthday (birthday), Annual leave (time off), Midsummer (all-day event)"
    );
    expect(
      [...arch.querySelectorAll("[data-kind]")].map((g) => g.getAttribute("data-kind"))
    ).toEqual(["birthday", "time-off", "other"]);
    expect(arch.querySelector("[data-overflow]")).toBeNull();
  });

  it("collapses events beyond its capacity into +N, but still names them all", () => {
    const items = Array.from({ length: 7 }, (_, i) => item(`Event ${i}`, "other"));
    render(<AllDayArch items={items} capacity={5} />);
    const arch = screen.getByRole("img");
    expect(arch.querySelectorAll("[data-kind]")).toHaveLength(4);
    expect(arch.querySelector("[data-overflow]")?.textContent).toContain("+3");
    expect(arch.getAttribute("aria-label")).toContain("Event 6");
  });
});
