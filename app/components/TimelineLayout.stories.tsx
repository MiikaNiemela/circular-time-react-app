import { expect } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { SectionPlaceholder, TimelineLayout } from "./TimelineLayout";
import { CalendarLegend } from "./CalendarLegend";
import { SegmentedControl } from "./SegmentedControl";
import { PeriodNavigator } from "./PeriodNavigator";
import { ThemeProvider } from "./ThemeProvider";
import { MultiCircle } from "./timeline";
import { slicesForView } from "../lib/timeSlices";
import { circleFrame, timeline } from "../routes/home.css";
import { vars } from "../styles/theme.css";

const DAY = new Date(2026, 5, 23);

/** The full layout inside a box of the given width. */
function LayoutAt({ width }: { width: number }) {
  return (
    <ThemeProvider>
      <div data-testid="frame" style={{ width, outline: "1px dashed #999" }}>
        <TimelineLayout
          brand={<span>Circular Time</span>}
          actions={<button type="button">⚙</button>}
          controls={
            <>
              <SegmentedControl value="day" onChange={() => {}} />
              <PeriodNavigator view="day" value={DAY} onChange={() => {}} now={DAY} />
            </>
          }
          circle={
            <div className={circleFrame}>
              <MultiCircle
                rings={slicesForView("day", DAY)}
                labelFontFamily={vars.font.mono}
                className={timeline}
                hand={{ degrees: 215, color: "#dc2626" }}
              />
            </div>
          }
          sections={[
            {
              id: "all-day",
              title: "All day",
              content: <SectionPlaceholder>All-day events will be listed here.</SectionPlaceholder>,
            },
            {
              id: "calendars",
              title: "Calendars",
              content: (
                <CalendarLegend
                  items={[
                    { id: "google", label: "Google Calendar" },
                    { id: "outlook", label: "Outlook" },
                  ]}
                />
              ),
            },
            {
              id: "agenda",
              title: "Up next",
              content: (
                <SectionPlaceholder>The day&apos;s events will be listed here.</SectionPlaceholder>
              ),
            },
          ]}
        />
      </div>
    </ThemeProvider>
  );
}

const meta: Meta<typeof LayoutAt> = {
  title: "Layout/TimelineLayout",
  component: LayoutAt,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof LayoutAt>;

const box = (el: Element) => el.getBoundingClientRect();
const part = (root: HTMLElement, name: string) =>
  root.querySelector<HTMLElement>(`[data-layout="${name}"]`)!;

/** Checks the layout: column count, visual order, and no horizontal overflow. */
async function checkLayout(root: HTMLElement, columns: 1 | 2, sections: string[]) {
  const body = part(root, "body");
  const frame = root.querySelector<HTMLElement>('[data-testid="frame"]')!;
  const brand = box(part(root, "brand"));
  const controls = box(part(root, "controls"));
  const circle = box(part(root, "circle"));
  const panel = box(part(root, "panel"));

  await expect(getComputedStyle(body).gridTemplateColumns.split(" ")).toHaveLength(columns);
  if (columns === 1) {
    // Controls sit below the brand row, then the circle, then the panel.
    await expect(controls.top).toBeGreaterThanOrEqual(brand.bottom);
    await expect(circle.top).toBeGreaterThanOrEqual(controls.bottom);
    await expect(panel.top).toBeGreaterThanOrEqual(circle.bottom);
  } else {
    // Controls share the header row; the panel sits beside the circle.
    await expect(controls.top).toBeLessThan(brand.bottom);
    await expect(panel.left).toBeGreaterThanOrEqual(circle.right);
    await expect(Math.abs(panel.top - circle.top)).toBeLessThan(1);
  }
  // The sections that are shown, top to bottom.
  const shown = [...root.querySelectorAll<HTMLElement>("[data-section]")]
    .filter((el) => getComputedStyle(el).display !== "none")
    .sort((a, b) => box(a).top - box(b).top)
    .map((el) => el.dataset.section);
  await expect(shown).toEqual(sections);
  await expect(frame.scrollWidth).toBeLessThanOrEqual(frame.clientWidth);
  const svg = part(root, "circle").querySelector("svg")!;
  await expect(box(svg).width).toBeLessThanOrEqual(560);
}

/** Phone (390 px): one column in reading order. */
export const Mobile390: Story = {
  args: { width: 390 },
  play: async ({ canvasElement }) =>
    checkLayout(canvasElement, 1, ["all-day", "calendars", "agenda"]),
};

/** Tablet (768 px): still one column; the circle is capped at 560 px and centred. */
export const Tablet768: Story = {
  args: { width: 768 },
  play: async ({ canvasElement }) =>
    checkLayout(canvasElement, 1, ["all-day", "calendars", "agenda"]),
};

/** Desktop (1280 px): header row, circle left, panel right. */
export const Desktop1280: Story = {
  args: { width: 1280 },
  play: async ({ canvasElement }) =>
    checkLayout(canvasElement, 2, ["all-day", "calendars", "agenda"]),
};

/** Times and numerals use the mono face; prose uses the UI face. */
export const Typography: Story = {
  args: { width: 1280 },
  play: async ({ canvasElement }) => {
    const family = (el: Element) => getComputedStyle(el).fontFamily;
    const navigatorDate = canvasElement.querySelector('[aria-label="Navigate periods"] span')!;
    const hourLabel = canvasElement.querySelector("svg textPath")!.closest("text")!;
    const prose = canvasElement.querySelector("[data-section] p")!;
    await expect(family(navigatorDate)).toMatch(/^"IBM Plex Mono"/);
    await expect(family(hourLabel)).toMatch(/^"IBM Plex Mono"/);
    await expect(family(prose)).toMatch(/^"Hanken Grotesk"/);
  },
};
