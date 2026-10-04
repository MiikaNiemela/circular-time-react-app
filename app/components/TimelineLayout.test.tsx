import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { TimelineLayout, type PanelSection } from "./TimelineLayout";

function renderLayout(
  sections: PanelSection[] = [{ id: "a", title: "Calendars", content: <p>legend</p> }]
) {
  return render(
    <TimelineLayout
      brand={<span>Circular Time</span>}
      actions={<button type="button">Settings</button>}
      controls={<div role="group" aria-label="Time view" />}
      circle={<svg data-testid="circle" />}
      sections={sections}
    />
  );
}

describe("TimelineLayout", () => {
  it("puts brand, actions and controls in the header", () => {
    renderLayout();
    const header = screen.getByRole("banner");
    expect(within(header).getByText("Circular Time")).toBeTruthy();
    expect(within(header).getByRole("button", { name: "Settings" })).toBeTruthy();
    expect(within(header).getByRole("group", { name: "Time view" })).toBeTruthy();
  });

  it("keeps the reading order: header, controls, circle, then sections", () => {
    const { container } = renderLayout();
    const order = [...container.querySelectorAll("[data-layout]")].map((el) =>
      el.getAttribute("data-layout")
    );
    expect(order).toEqual(["header", "brand", "actions", "controls", "body", "circle", "panel"]);
  });

  it("renders each section with a heading that names it", () => {
    renderLayout([
      { id: "all-day", title: "All day", content: <p>chips</p> },
      { id: "calendars", title: "Calendars", content: <p>legend</p> },
    ]);
    const regions = screen.getAllByRole("region");
    expect(regions.map((r) => r.getAttribute("aria-labelledby"))).toEqual([
      "section-all-day",
      "section-calendars",
    ]);
    expect(within(regions[1]).getByRole("heading", { name: "Calendars" })).toBeTruthy();
  });

  it("leaves out the panel when there are no sections", () => {
    const { container } = renderLayout([]);
    expect(container.querySelector('[data-layout="panel"]')).toBeNull();
  });
});
