import { expect, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { DayAgenda } from "./DayAgenda";
import { ThemeProvider } from "./ThemeProvider";
import { layoutContainer } from "./TimelineLayout.css";
import { dayAgenda } from "../lib/dayAgenda";
import { eventWindow } from "../data/eventSlices";
import { calendarLabel } from "./CalendarLegend";

const at = (h: number, m = 0, d = 23) => new Date(2026, 5, d, h, m).toISOString();
const DAY = eventWindow("day", new Date(2026, 5, 23));
const NOW = new Date(2026, 5, 23, 14, 20);

const BUSY = [
  {
    id: "1",
    calendarId: "outlook",
    title: "Night shift",
    start: at(22, 0, 22),
    end: at(2),
    color: "#7c3aed",
  },
  {
    id: "2",
    calendarId: "google",
    title: "Morning run",
    start: at(7),
    end: at(7, 45),
    color: "#0d9488",
  },
  {
    id: "3",
    calendarId: "outlook",
    title: "Standup",
    start: at(8, 30),
    end: at(8, 45),
    color: "#2563eb",
  },
  {
    id: "4",
    calendarId: "google",
    title: "Deep work",
    start: at(9),
    end: at(12),
    color: "#0d9488",
  },
  { id: "5", calendarId: "google", title: "Lunch", start: at(12), end: at(13), color: "#f59e0b" },
  {
    id: "6",
    calendarId: "outlook",
    title: "1:1 · Mara",
    start: at(13),
    end: at(13, 30),
    color: "#2563eb",
  },
  {
    id: "7",
    calendarId: "outlook",
    title: "Design review",
    start: at(15),
    end: at(16, 30),
    color: "#2563eb",
  },
  {
    id: "8",
    calendarId: "google",
    title: "Dinner with friends",
    start: at(19),
    end: at(21, 30),
    color: "#f59e0b",
  },
  {
    id: "9",
    calendarId: "google",
    title: "Late flight",
    start: at(23, 30),
    end: at(1, 0, 24),
    color: "#7c3aed",
  },
];

function Frame({ width, events, now }: { width: number; events: typeof BUSY; now: Date | null }) {
  return (
    <ThemeProvider>
      <div className={layoutContainer} style={{ width, minHeight: "auto", padding: 16 }}>
        <DayAgenda
          items={dayAgenda(events, DAY, now, "en-GB")}
          calendarName={calendarLabel}
          onSelect={() => {}}
        />
      </div>
    </ThemeProvider>
  );
}

const meta: Meta<typeof Frame> = {
  title: "Timeline/DayAgenda",
  component: Frame,
};
export default meta;
type Story = StoryObj<typeof Frame>;

/** A busy day on a wide layout: the full day, past events muted, the next one marked. */
export const BusyDesktop: Story = {
  args: { width: 380, events: BUSY, now: NOW },
  render: (args) => (
    <div style={{ width: 1100 }}>
      <Frame {...args} width={1100} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: /Morning run/ })).toBeVisible();
    await expect(canvas.getByRole("button", { name: /Design review/ })).toHaveTextContent(
      "Up next"
    );
    await expect(canvas.getByRole("button", { name: /Night shift/ })).toHaveTextContent(
      "started earlier"
    );
  },
};

/** Mobile: only upcoming events until the full day is expanded. */
export const BusyMobile: Story = {
  args: { width: 390, events: BUSY, now: NOW },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Hidden past rows are out of the accessibility tree as well.
    await expect(canvas.queryByRole("button", { name: /Morning run/ })).toBeNull();
    await expect(canvas.getByRole("button", { name: /Design review/ })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: /Show full day/ }));
    await expect(canvas.getByRole("button", { name: /Morning run/ })).toBeVisible();
  },
};

/** Another day: nothing is past or next. */
export const AnotherDay: Story = {
  args: { width: 390, events: BUSY, now: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText("Up next")).toBeNull();
    await expect(canvas.getByRole("button", { name: /Morning run/ })).toBeVisible();
  },
};

/** A day with no timed events. */
export const Empty: Story = {
  args: { width: 390, events: [], now: NOW },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("No timed events.")).toBeVisible();
  },
};
