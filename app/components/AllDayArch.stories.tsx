import { expect, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { AllDayArch, ARCH_OVERLAP } from "./AllDayArch";
import { AllDayList } from "./AllDayList";
import { ThemeProvider } from "./ThemeProvider";
import { MultiCircle } from "./timeline";
import { slicesForView } from "../lib/timeSlices";
import type { AllDayItem } from "../lib/allDay";
import type { AllDayKind } from "../data/types";
import { circleFrame, timeline } from "../routes/home.css";
import { vars } from "../styles/theme.css";

const DAY = new Date(2026, 5, 23);

function item(title: string, kind: AllDayKind): AllDayItem {
  return {
    key: `google:${title}`,
    title,
    kind,
    event: { id: title, calendarId: "google", title, start: "", end: "", allDay: true, kind },
  };
}

const THREE = [
  item("Mara's birthday", "birthday"),
  item("Annual leave", "time-off"),
  item("Midsummer Eve", "other"),
];
const EIGHT = [
  ...THREE,
  item("Leo's birthday", "birthday"),
  item("Conference", "other"),
  item("Team offsite", "other"),
  item("Parental leave", "time-off"),
  item("Garbage day", "other"),
];

function Preview({ items }: { items: AllDayItem[] }) {
  return (
    <ThemeProvider>
      <div style={{ width: 420, padding: 16, background: vars.color.background }}>
        <div className={circleFrame}>
          <AllDayArch items={items} />
          <div style={items.length > 0 ? { marginTop: `-${ARCH_OVERLAP}%` } : undefined}>
            <MultiCircle
              rings={slicesForView("day", DAY)}
              className={timeline}
              labelFontFamily={vars.font.mono}
            />
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <AllDayList items={items} onSelect={() => {}} />
        </div>
      </div>
    </ThemeProvider>
  );
}

const meta: Meta<typeof Preview> = { title: "Timeline/AllDayArch", component: Preview };
export default meta;
type Story = StoryObj<typeof Preview>;

/** No all-day events: no arch. */
export const None: Story = {
  args: { items: [] },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("[data-all-day-arch]")).toBeNull();
  },
};

/** One event, at 12 o'clock. */
export const One: Story = {
  args: { items: [THREE[0]] },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll("[data-all-day-arch] [data-kind]")).toHaveLength(1);
  },
};

/** One of each kind. */
export const Three: Story = {
  args: { items: THREE },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll("[data-all-day-arch] [data-kind]")).toHaveLength(3);
  },
};

/** More than fit: the arch ends in "+4"; the list shows all eight. */
export const Overflowing: Story = {
  args: { items: EIGHT },
  play: async ({ canvasElement }) => {
    const arch = canvasElement.querySelector("[data-all-day-arch]")!;
    await expect(arch.querySelector("[data-overflow]")).toHaveTextContent("+4");
    await expect(within(canvasElement).getAllByRole("listitem")).toHaveLength(8);
  },
};
