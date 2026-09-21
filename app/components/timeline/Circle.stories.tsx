import { fn, expect, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Circle } from ".";

const meta: Meta<typeof Circle> = {
  title: "Timeline/Circle",
  component: Circle,
  parameters: {
    layout: "centered",
  },
  args: {
    onSliceClick: fn(),
  },
  argTypes: {
    lineWidth: { control: { type: "range", min: 4, max: 60, step: 2 } },
    size: { control: { type: "range", min: 80, max: 400, step: 10 } },
  },
};
export default meta;

type Story = StoryObj<typeof Circle>;

/** A single solid ring — the degenerate full-360° case. */
export const FullRing: Story = {
  args: {
    slices: [{ color: "#2563eb", degrees: 360 }],
    lineWidth: 20,
    size: 200,
  },
};

/** Four equal quadrants in distinct colours. */
export const Quadrants: Story = {
  args: {
    slices: [
      { color: "#2563eb", degrees: 90 },
      { color: "#16a34a", degrees: 90 },
      { color: "#dc2626", degrees: 90 },
      { color: "#d97706", degrees: 90 },
    ],
    lineWidth: 20,
    size: 200,
  },
};

/** A slice spanning more than 180° (large-arc flag = 1). */
export const LargeArc: Story = {
  args: {
    slices: [
      { color: "#2563eb", degrees: 270 },
      { color: "#e5e7eb", degrees: 90 },
    ],
    lineWidth: 20,
    size: 200,
  },
};

/** Thin ring to verify lineWidth is respected. */
export const ThinRing: Story = {
  args: {
    slices: [
      { color: "#2563eb", degrees: 180 },
      { color: "#dc2626", degrees: 180 },
    ],
    lineWidth: 4,
    size: 200,
  },
};

/** A day-like schedule: sleep, work, free time. */
export const DaySchedule: Story = {
  args: {
    slices: [
      { color: "#6366f1", degrees: 120 }, // 8 h sleep
      { color: "#f59e0b", degrees: 30 }, // 2 h morning
      { color: "#2563eb", degrees: 135 }, // 9 h work
      { color: "#10b981", degrees: 75 }, // 5 h free
    ],
    lineWidth: 24,
    size: 240,
  },
};

/** Clickable slices — tab to see the arc-shaped focus ring; check Actions for callbacks.
 * Slices carry eventId so they are visible and become interactive buttons. */
export const Clickable: Story = {
  args: {
    slices: [
      { color: "#2563eb", degrees: 90, eventId: "demo:1" },
      { color: "#16a34a", degrees: 90, eventId: "demo:2" },
      { color: "#dc2626", degrees: 90, eventId: "demo:3" },
      { color: "#d97706", degrees: 90, eventId: "demo:4" },
    ],
    lineWidth: 24,
    size: 220,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [firstSegment] = canvas.getAllByRole("button");
    await userEvent.tab();
    expect(firstSegment).toHaveFocus();
    // The default rectangular outline must be suppressed; the arc-shaped
    // drop-shadow focus ring (from the CSS class) replaces it.
    const styles = window.getComputedStyle(firstSegment);
    expect(styles.outlineStyle).toBe("none");
    // The drop-shadow filter must be active on :focus-visible — this verifies
    // the arc-shaped glow fires, not just that the rectangle is hidden.
    expect(styles.filter).toContain("drop-shadow");
  },
};
