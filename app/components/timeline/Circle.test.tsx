import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { Circle } from "./Circle";
import type { Slice } from "./Slice";

// Slices that carry eventId — these are the only slices that become interactive
// and visible (strokeOpacity 1).
const eventSlice = (color: string, degrees: number, id = "cal:ev1"): Slice => ({
  color,
  degrees,
  eventId: id,
});

describe("Circle", () => {
  it("renders an SVG element", () => {
    const { container } = render(
      <Circle slices={[{ color: "red", degrees: 360 }]} lineWidth={10} />
    );
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("renders a <circle> for a full 360° slice", () => {
    const { container } = render(
      <Circle slices={[{ color: "blue", degrees: 360 }]} lineWidth={10} />
    );
    expect(container.querySelector("circle")).toBeTruthy();
    expect(container.querySelector("path")).toBeNull();
  });

  it("renders <path> elements for partial slices", () => {
    const slices: Slice[] = [
      { color: "red", degrees: 90 },
      { color: "blue", degrees: 180 },
      { color: "green", degrees: 90 },
    ];
    const { container } = render(<Circle slices={slices} lineWidth={8} />);
    expect(container.querySelectorAll("path").length).toBe(3);
    expect(container.querySelector("circle")).toBeNull();
  });

  it("skips slices with 0 degrees", () => {
    const slices: Slice[] = [
      { color: "red", degrees: 0 },
      { color: "blue", degrees: 180 },
    ];
    const { container } = render(<Circle slices={slices} lineWidth={8} />);
    expect(container.querySelectorAll("path").length).toBe(1);
  });

  it("respects the size prop for SVG dimensions", () => {
    const { container } = render(
      <Circle slices={[{ color: "red", degrees: 90 }]} lineWidth={10} size={300} />
    );
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("300");
    expect(svg.getAttribute("height")).toBe("300");
    expect(svg.getAttribute("viewBox")).toBe("0 0 300 300");
  });

  it("defaults to size 200", () => {
    const { container } = render(
      <Circle slices={[{ color: "red", degrees: 90 }]} lineWidth={10} />
    );
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("200");
  });

  it("calls onSliceClick with the slice and its index when clicked", () => {
    const handler = vi.fn();
    const slices: Slice[] = [
      eventSlice("#ff0000", 180, "cal:ev1"),
      eventSlice("#00ff00", 180, "cal:ev2"),
    ];
    const { container } = render(<Circle slices={slices} lineWidth={10} onSliceClick={handler} />);
    const paths = container.querySelectorAll("path");
    fireEvent.click(paths[1]);
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(slices[1], 1);
  });

  it("makes event slices keyboard-activatable when onSliceClick is provided", () => {
    const handler = vi.fn();
    const { container } = render(
      <Circle slices={[eventSlice("red", 180)]} lineWidth={10} onSliceClick={handler} />
    );
    const path = container.querySelector("path")!;
    expect(path.getAttribute("role")).toBe("button");
    expect(path.getAttribute("tabindex")).toBe("0");
    fireEvent.keyDown(path, { key: "Enter" });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("gap slices (no eventId) are not interactive even when onSliceClick is provided", () => {
    const handler = vi.fn();
    const { container } = render(
      <Circle slices={[{ color: "red", degrees: 180 }]} lineWidth={10} onSliceClick={handler} />
    );
    const path = container.querySelector("path")!;
    expect(path.getAttribute("role")).toBeNull();
    expect(path.getAttribute("tabindex")).toBeNull();
    fireEvent.click(path);
    expect(handler).not.toHaveBeenCalled();
  });

  it("does not add interactive attributes when onSliceClick is absent", () => {
    const { container } = render(
      <Circle slices={[{ color: "red", degrees: 180 }]} lineWidth={10} />
    );
    const path = container.querySelector("path")!;
    expect(path.getAttribute("role")).toBeNull();
    expect(path.getAttribute("tabindex")).toBeNull();
  });

  it("suppresses the default outline on interactive event arc elements", () => {
    const { container } = render(
      <Circle slices={[eventSlice("red", 180)]} lineWidth={10} onSliceClick={vi.fn()} />
    );
    const path = container.querySelector("path")!;
    // Inline outline:none makes the rectangle invisible; verifiable in jsdom.
    expect(path.style.outline).toBe("none");
    // CSS class for the arc-shaped focus ring and hover feedback is also present.
    expect(path.hasAttribute("class")).toBe(true);
  });

  it("does not suppress outline or add a class when non-interactive", () => {
    const { container } = render(
      <Circle slices={[{ color: "red", degrees: 180 }]} lineWidth={10} />
    );
    const path = container.querySelector("path")!;
    expect(path.style.outline).toBe("");
    expect(path.hasAttribute("class")).toBe(false);
  });

  it("applies the correct stroke colour to each arc", () => {
    const slices: Slice[] = [
      { color: "#ff0000", degrees: 120 },
      { color: "#00ff00", degrees: 120 },
    ];
    const { container } = render(<Circle slices={slices} lineWidth={10} />);
    const paths = container.querySelectorAll("path");
    expect(paths[0].getAttribute("stroke")).toBe("#ff0000");
    expect(paths[1].getAttribute("stroke")).toBe("#00ff00");
  });

  // ---------------------------------------------------------------------------
  // Visibility: gap vs event slices
  // ---------------------------------------------------------------------------

  it("event slices (with eventId) have strokeOpacity 1", () => {
    const { container } = render(<Circle slices={[eventSlice("red", 180)]} lineWidth={10} />);
    const path = container.querySelector("path")!;
    expect(path.getAttribute("stroke-opacity")).toBe("1");
  });

  it("gap slices (no eventId) have strokeOpacity 0", () => {
    const { container } = render(
      <Circle slices={[{ color: "grey", degrees: 180 }]} lineWidth={10} />
    );
    const path = container.querySelector("path")!;
    expect(path.getAttribute("stroke-opacity")).toBe("0");
  });

  // ---------------------------------------------------------------------------
  // Label rendering
  // ---------------------------------------------------------------------------

  it("renders a textPath for a labeled slice that spans at least 10°", () => {
    const { container } = render(
      <Circle slices={[{ color: "blue", degrees: 30, label: "12" }]} lineWidth={20} />
    );
    const textPath = container.querySelector("textPath");
    expect(textPath).toBeTruthy();
    expect(textPath!.textContent).toBe("12");
  });

  it("does not render a textPath for a labeled slice below 10°", () => {
    const { container } = render(
      <Circle slices={[{ color: "blue", degrees: 5, label: "1" }]} lineWidth={20} />
    );
    expect(container.querySelector("textPath")).toBeNull();
  });

  it("does not render a textPath for a slice without a label", () => {
    const { container } = render(
      <Circle slices={[{ color: "blue", degrees: 90 }]} lineWidth={20} />
    );
    expect(container.querySelector("textPath")).toBeNull();
  });
});
