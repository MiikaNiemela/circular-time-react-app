import { expect, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { createRoutesStub } from "react-router";
import Home from "./home";
import { formatLocalDate } from "../lib/localDate";

// Stub the settings route so the <Link to="/settings"> in the empty-state
// prompt navigates without a full router.
function SettingsStub() {
  return <div data-testid="settings-stub">Settings</div>;
}

const HomeStub = createRoutesStub([
  {
    path: "/",
    Component: Home,
    // Provide the loader data shape the component expects from useLoaderData().
    // No server calendars, so the development fixture renders.
    loader: () => ({
      serverCalendars: [],
      failedCalendars: [],
      view: "day",
      ref: formatLocalDate(new Date()),
    }),
  },
  { path: "/settings", Component: SettingsStub },
]);

function renderHome() {
  return (
    <div style={{ minHeight: "100dvh" }}>
      <HomeStub initialEntries={["/"]} />
    </div>
  );
}

const meta: Meta = {
  title: "Routes/Home",
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj;

/**
 * Dev fixture active: the account has no connected calendars, so the fixture
 * calendars are injected, producing two event rings. Clicking a fixture event opens the
 * EventDetail overlay — this exercises the click→detail flow without OAuth.
 *
 * Ring 1 (index 0) is the dev-google calendar (background grid is hidden by
 * default). Segment 2 is the "Standup" event (sliceIndex 1, preceded by
 * the pre-event gap at sliceIndex 0 which is transparent and not a button).
 */
export const WithDevFixture: Story = {
  beforeEach: () => {
    localStorage.clear();
    return () => localStorage.clear();
  },
  render: renderHome,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Wait for the dev-google event ring to appear; segment 2 is the Focus block.
    const eventSlice = await canvas.findByRole("button", { name: "Ring 1 segment 2" });
    await userEvent.click(eventSlice);
    const dialog = await canvas.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("Standup")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Close" }));
    expect(canvas.queryByRole("dialog")).not.toBeInTheDocument();
  },
};

/** Today's local date as an all-day event stores it: UTC midnights of the dates. */
function allDayToday(id: string, title: string, kind: "birthday" | "time-off" | "other") {
  const now = new Date();
  const day = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return {
    id,
    calendarId: "google",
    title,
    start: new Date(day).toISOString(),
    end: new Date(day + 24 * 60 * 60 * 1000).toISOString(),
    allDay: true,
    kind,
  };
}

const AllDayHomeStub = createRoutesStub([
  {
    path: "/",
    Component: Home,
    loader: () => ({
      serverCalendars: [
        {
          calendarId: "google",
          fetchedRange: null,
          events: [
            allDayToday("b", "Mara's birthday", "birthday"),
            allDayToday("l", "Annual leave", "time-off"),
          ],
        },
      ],
      failedCalendars: [],
      view: "day",
      ref: formatLocalDate(new Date()),
    }),
  },
  { path: "/settings", Component: SettingsStub },
]);

/**
 * A phone-width timeline with all-day events: the arch shows them, and the
 * All day list keeps every one readable and selectable on narrow layouts too.
 */
export const AllDayOnNarrowLayout: Story = {
  beforeEach: () => {
    localStorage.clear();
    return () => localStorage.clear();
  },
  render: () => (
    <div style={{ width: 390 }}>
      <AllDayHomeStub initialEntries={["/"]} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("img", { name: /All day: Mara's birthday \(birthday\)/ });
    const chip = await canvas.findByRole("button", { name: "Mara's birthday (birthday)" });
    await expect(chip).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Annual leave (time off)" })).toBeVisible();
    await userEvent.click(chip);
    const dialog = await canvas.findByRole("dialog", { name: "Mara's birthday" });
    await expect(dialog).toBeInTheDocument();
  },
};
