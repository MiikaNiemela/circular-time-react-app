import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { MultiCircle, ringRadius } from "./MultiCircle";
import type { RingConfig } from "./MultiCircle";

// ---------------------------------------------------------------------------
// ringRadius — pure centering math
// ---------------------------------------------------------------------------
describe("ringRadius", () => {
  it("insets the radius so the stroke stays inside the declared size", () => {
    expect(ringRadius(200, 20)).toBe(90);
    expect(ringRadius(100, 10)).toBe(45);
  });

  it("a smaller ring inside a larger one has a smaller radius", () => {
    expect(ringRadius(120, 16)).toBeLessThan(ringRadius(200, 16));
  });
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// Gap ring — no eventId, will be transparent and non-interactive.
const dayRing: RingConfig = {
  slices: [
    { color: "#6366f1", degrees: 120 },
    { color: "#2563eb", degrees: 240 },
  ],
  lineWidth: 20,
  size: 200,
};

// Event ring — slices carry eventId so they are visible and clickable.
const eventRing: RingConfig = {
  slices: [
    { color: "#6366f1", degrees: 120, eventId: "cal:ev1" },
    { color: "#2563eb", degrees: 240, eventId: "cal:ev2" },
  ],
  lineWidth: 20,
  size: 200,
};

// Full-circle gap ring (360° single gap slice, no eventId).
const weekRing: RingConfig = {
  slices: [{ color: "#10b981", degrees: 360 }],
  lineWidth: 14,
  size: 140,
};

// Full-circle event ring (360° single event slice).
const clickableWeekRing: RingConfig = {
  slices: [{ color: "#10b981", degrees: 360, eventId: "cal:wk" }],
  lineWidth: 14,
  size: 140,
};

// Helper: select circles that are NOT ghost rings.
function eventCircles(container: HTMLElement): NodeListOf<Element> {
  return container.querySelectorAll("circle:not([data-ghost])");
}

// ---------------------------------------------------------------------------
// MultiCircle — rendering
// ---------------------------------------------------------------------------
describe("MultiCircle", () => {
  it("returns null for an empty rings array", () => {
    const { container } = render(<MultiCircle rings={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("SVG dimensions equal the largest ring size", () => {
    const { container } = render(<MultiCircle rings={[dayRing, weekRing]} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("200");
    expect(svg.getAttribute("height")).toBe("200");
    expect(svg.getAttribute("viewBox")).toBe("0 0 200 200");
  });

  it("works with a single ring", () => {
    const { container } = render(<MultiCircle rings={[dayRing]} />);
    expect(container.querySelector("svg")).toBeTruthy();
    expect(container.querySelectorAll("path").length).toBe(2);
  });

  it("renders a <circle> element for a full 360° ring slice", () => {
    const { container } = render(<MultiCircle rings={[weekRing, dayRing]} />);
    // weekRing's 360° slice renders as <circle>; ghost rings also use <circle>
    // but are distinguished by data-ghost.
    expect(eventCircles(container).length).toBeGreaterThan(0);
  });

  it("all rings share the same SVG centre point", () => {
    // Ghost ring's <circle> cx/cy must equal maxSize/2 = 100.
    const { container } = render(<MultiCircle rings={[dayRing, weekRing]} />);
    const ghost = container.querySelector("circle[data-ghost]")!;
    expect(ghost.getAttribute("cx")).toBe("100");
    expect(ghost.getAttribute("cy")).toBe("100");
  });

  it("inner ring has a smaller radius than the outer ring", () => {
    const { container } = render(<MultiCircle rings={[dayRing, weekRing]} />);
    // weekRing: r = ringRadius(140, 14) = 63; outer ring r = ringRadius(200, 20) = 90
    // The non-ghost circle is weekRing's 360° slice.
    const circle = eventCircles(container)[0] as Element;
    expect(Number(circle.getAttribute("r"))).toBe(63);
  });

  it("applies correct stroke colour per slice", () => {
    const { container } = render(<MultiCircle rings={[dayRing]} />);
    const paths = container.querySelectorAll("path");
    expect(paths[0].getAttribute("stroke")).toBe("#6366f1");
    expect(paths[1].getAttribute("stroke")).toBe("#2563eb");
  });

  it("skips slices with 0 degrees", () => {
    const ring: RingConfig = {
      slices: [
        { color: "red", degrees: 0 },
        { color: "blue", degrees: 180 },
      ],
      lineWidth: 10,
      size: 200,
    };
    const { container } = render(<MultiCircle rings={[ring]} />);
    expect(container.querySelectorAll("path").length).toBe(1);
  });

  it("calls onSliceClick with slice, sliceIndex, and ringIndex when clicked", () => {
    const handler = vi.fn();
    const { container } = render(
      <MultiCircle rings={[eventRing, clickableWeekRing]} onSliceClick={handler} />
    );
    const paths = container.querySelectorAll("path");
    // eventRing has 2 paths (slices[0] and slices[1]); click the second
    fireEvent.click(paths[1]);
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(eventRing.slices[1], 1, 0);
  });

  it("passes the correct ringIndex for inner ring clicks", () => {
    const handler = vi.fn();
    const { container } = render(
      <MultiCircle rings={[eventRing, clickableWeekRing]} onSliceClick={handler} />
    );
    // clickableWeekRing is ring index 1 and has one full-360° event slice
    // rendered as <circle> (not a ghost ring).
    const circle = eventCircles(container)[0] as HTMLElement;
    fireEvent.click(circle);
    expect(handler).toHaveBeenCalledWith(clickableWeekRing.slices[0], 0, 1);
  });

  it("makes event slices keyboard-activatable via Space key", () => {
    const handler = vi.fn();
    const { container } = render(<MultiCircle rings={[eventRing]} onSliceClick={handler} />);
    const path = container.querySelector("path")!;
    expect(path.getAttribute("role")).toBe("button");
    fireEvent.keyDown(path, { key: " " });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("forwards className to the root svg so it can be sized responsively", () => {
    const { container } = render(<MultiCircle rings={[dayRing]} className="responsive" />);
    expect(container.querySelector("svg")!.getAttribute("class")).toBe("responsive");
  });

  it("does not add interactive attributes when onSliceClick is absent", () => {
    const { container } = render(<MultiCircle rings={[dayRing]} />);
    const path = container.querySelector("path")!;
    expect(path.getAttribute("role")).toBeNull();
  });

  it("gap slices (no eventId) are not interactive even when onSliceClick is provided", () => {
    const handler = vi.fn();
    const { container } = render(<MultiCircle rings={[dayRing]} onSliceClick={handler} />);
    const path = container.querySelector("path")!;
    expect(path.getAttribute("role")).toBeNull();
    fireEvent.click(path);
    expect(handler).not.toHaveBeenCalled();
  });

  it("suppresses the default outline on interactive event arc elements", () => {
    const { container } = render(<MultiCircle rings={[eventRing]} onSliceClick={vi.fn()} />);
    const path = container.querySelector("path")!;
    expect(path.style.outline).toBe("none");
    expect(path.hasAttribute("class")).toBe(true);
  });

  it("does not suppress outline or add a class when non-interactive", () => {
    const { container } = render(<MultiCircle rings={[dayRing]} />);
    const path = container.querySelector("path")!;
    expect(path.style.outline).toBe("");
    expect(path.hasAttribute("class")).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Ghost rings
  // ---------------------------------------------------------------------------

  it("renders one ghost circle per ring", () => {
    const { container } = render(<MultiCircle rings={[dayRing, weekRing]} />);
    const ghosts = container.querySelectorAll("circle[data-ghost]");
    expect(ghosts.length).toBe(2);
  });

  it("ghost circles have very low strokeOpacity", () => {
    const { container } = render(<MultiCircle rings={[dayRing]} />);
    const ghost = container.querySelector("circle[data-ghost]")!;
    expect(Number(ghost.getAttribute("stroke-opacity"))).toBeLessThan(0.15);
  });

  it("ghost circles are aria-hidden", () => {
    const { container } = render(<MultiCircle rings={[dayRing]} />);
    const ghost = container.querySelector("circle[data-ghost]")!;
    expect(ghost.getAttribute("aria-hidden")).toBe("true");
  });

  // ---------------------------------------------------------------------------
  // Visibility: gap vs event slices
  // ---------------------------------------------------------------------------

  it("event slices (with eventId) have strokeOpacity 1", () => {
    const { container } = render(<MultiCircle rings={[eventRing]} />);
    const paths = container.querySelectorAll("path");
    paths.forEach((p) => expect(p.getAttribute("stroke-opacity")).toBe("1"));
  });

  it("gap slices (no eventId) have strokeOpacity 0", () => {
    const { container } = render(<MultiCircle rings={[dayRing]} />);
    const paths = container.querySelectorAll("path");
    paths.forEach((p) => expect(p.getAttribute("stroke-opacity")).toBe("0"));
  });

  it("background slices (visible: true, no eventId) have strokeOpacity 1", () => {
    const bgRing: RingConfig = {
      slices: [
        { color: "#2563eb", degrees: 120, visible: true },
        { color: "#e5e7eb", degrees: 240, visible: true },
      ],
      lineWidth: 24,
      size: 280,
    };
    const { container } = render(<MultiCircle rings={[bgRing]} />);
    const paths = container.querySelectorAll("path");
    paths.forEach((p) => expect(p.getAttribute("stroke-opacity")).toBe("1"));
  });

  // ---------------------------------------------------------------------------
  // Label rendering
  // ---------------------------------------------------------------------------

  it("renders a textPath for a labeled slice that spans at least 10°", () => {
    const ring: RingConfig = {
      slices: [{ color: "blue", degrees: 30, label: "Mon" }],
      lineWidth: 20,
      size: 200,
    };
    const { container } = render(<MultiCircle rings={[ring]} />);
    const textPath = container.querySelector("textPath");
    expect(textPath).toBeTruthy();
    expect(textPath!.textContent).toBe("Mon");
  });

  it("does not render a textPath for a labeled slice below 10°", () => {
    const ring: RingConfig = {
      slices: [{ color: "blue", degrees: 5, label: "x" }],
      lineWidth: 20,
      size: 200,
    };
    const { container } = render(<MultiCircle rings={[ring]} />);
    expect(container.querySelector("textPath")).toBeNull();
  });
});
