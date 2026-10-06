import { expect, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { createRoutesStub } from "react-router";
import Home from "./home";
import { formatLocalDate } from "../lib/localDate";
import { EXPECTED_DAY_LONG, EXPECTED_TIMED, eventKindCalendars } from "../lib/eventKindFixture";

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
      // As in development without a session: sample calendars.
      devFixture: true,
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

/** Today's whole local day as a fetched range. */
function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

type StoryLoaderData = {
  serverCalendars: Array<{
    calendarId: string;
    events: never[];
    fetchedRange: { start: string; end: string } | null;
  }>;
  failedCalendars: Array<{ calendarId: string; reason: "reconnect-required" | "unavailable" }>;
};

/** A route stub serving one blank state's loader data. */
function blankStateStub(data: StoryLoaderData) {
  return createRoutesStub([
    {
      path: "/",
      Component: Home,
      loader: () => ({ ...data, view: "day", ref: formatLocalDate(new Date()) }),
    },
    { path: "/settings", Component: SettingsStub },
  ]);
}

/** Builds the phone (390 px) and desktop (1280 px) stories of one blank state. */
function blankStateStories(
  data: StoryLoaderData,
  text: RegExp,
  action?: { role: "link" | "button"; name: string },
  hidden: string[] = []
): { mobile: Story; desktop: Story } {
  const Stub = blankStateStub(data);
  const story = (width: number): Story => ({
    parameters: { layout: "fullscreen" },
    beforeEach: () => {
      localStorage.clear();
      if (hidden.length > 0) {
        localStorage.setItem(
          "circular-time-calendar-visibility",
          JSON.stringify(Object.fromEntries(hidden.map((id) => [id, false])))
        );
      }
      return () => localStorage.clear();
    },
    render: () => (
      <div style={{ width }}>
        <Stub initialEntries={["/"]} />
      </div>
    ),
    play: async ({ canvasElement }) => {
      const view = within(canvasElement);
      await expect(await view.findByText(text)).toBeVisible();
      if (action) await expect(view.getByRole(action.role, { name: action.name })).toBeVisible();
      // A blank state really is blank: no event slices and no agenda rows.
      await expect(view.queryAllByRole("button", { name: /^Ring \d+ segment/ })).toHaveLength(0);
      await expect(view.queryByRole("list", { name: /agenda/i })).toBeNull();
    },
  });
  return { mobile: story(390), desktop: story(1280) };
}

const google = (fetched: boolean) => ({
  calendarId: "google",
  events: [] as never[],
  fetchedRange: fetched ? todayRange() : null,
});

const noSources = blankStateStories(
  { serverCalendars: [], failedCalendars: [] },
  /No calendars are connected yet/,
  { role: "link", name: "Connect a source" }
);
const allHidden = blankStateStories(
  { serverCalendars: [google(true)], failedCalendars: [] },
  /All your calendars are hidden/,
  { role: "link", name: "Choose calendars to show" },
  ["google"]
);
const reconnect = blankStateStories(
  {
    serverCalendars: [google(false)],
    failedCalendars: [{ calendarId: "google", reason: "reconnect-required" }],
  },
  /Google Calendar needs to be connected again/,
  { role: "button", name: "Reconnect Google Calendar" }
);
const unavailable = blankStateStories(
  {
    serverCalendars: [google(false)],
    failedCalendars: [{ calendarId: "google", reason: "unavailable" }],
  },
  /Google Calendar could not be reached/,
  { role: "button", name: "Try again" }
);
const noEvents = blankStateStories(
  { serverCalendars: [google(true)], failedCalendars: [] },
  /No events in this period/
);

/** 1. No calendars connected (phone): connect a source. */
export const BlankNoSourcesMobile = noSources.mobile;
/** 1. No calendars connected (desktop). */
export const BlankNoSourcesDesktop = noSources.desktop;
/** 2. Every connected calendar hidden (phone): choose calendars to show. */
export const BlankAllHiddenMobile = allHidden.mobile;
/** 2. Every connected calendar hidden (desktop). */
export const BlankAllHiddenDesktop = allHidden.desktop;
/** 3. A calendar needs reconnecting (phone): reconnect it. */
export const BlankReconnectMobile = reconnect.mobile;
/** 3. A calendar needs reconnecting (desktop). */
export const BlankReconnectDesktop = reconnect.desktop;
/** 4. Provider unavailable and nothing cached (phone): try again. */
export const BlankUnavailableMobile = unavailable.mobile;
/** 4. Provider unavailable and nothing cached (desktop). */
export const BlankUnavailableDesktop = unavailable.desktop;
/** 5. Everything read, nothing scheduled (phone): message only. */
export const BlankNoEventsMobile = noEvents.mobile;
/** 5. Everything read, nothing scheduled (desktop). */
export const BlankNoEventsDesktop = noEvents.desktop;

const EventKindsStub = createRoutesStub([
  {
    path: "/",
    Component: Home,
    // Raw Google and Outlook responses, run through the real providers.
    loader: async () => ({
      serverCalendars: await eventKindCalendars(new Date()),
      failedCalendars: [],
      devFixture: false,
      view: "day",
      ref: formatLocalDate(new Date()),
    }),
  },
  { path: "/settings", Component: SettingsStub },
]);

/**
 * Calendar event data → drawn icons, end to end: birthdays, all-day and
 * whole-day timed out-of-office, working location and ordinary all-day
 * events from both providers, next to timed events that must stay on the
 * ring. See `app/lib/eventKindFixture.ts`.
 */
export const EventKindsFromProviderData: Story = {
  beforeEach: () => {
    localStorage.clear();
    return () => localStorage.clear();
  },
  render: () => (
    <div style={{ width: 1280 }}>
      <EventKindsStub initialEntries={["/"]} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const kindLabel = { birthday: "birthday", "time-off": "time off", other: "all-day event" };
    const listed = EXPECTED_DAY_LONG.map((e) => `${e.title} (${kindLabel[e.kind]})`);
    await expect(
      await canvas.findByRole("img", { name: `All day: ${listed.join(", ")}` })
    ).toBeInTheDocument();
    const drawn = [...canvasElement.querySelectorAll("[data-all-day-arch] [data-kind]")].map((g) =>
      g.getAttribute("data-kind")
    );
    await expect(drawn).toEqual(EXPECTED_DAY_LONG.slice(0, drawn.length).map((e) => e.kind));
    for (const name of listed) await expect(canvas.getByRole("button", { name })).toBeVisible();
    await expect(canvas.queryAllByRole("button", { name: /^Ring \d+ segment/ })).toHaveLength(
      EXPECTED_TIMED.length
    );
  },
};
