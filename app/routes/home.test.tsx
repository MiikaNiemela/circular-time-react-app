import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { createRoutesStub } from "react-router";
import Home, { loader, serverReadWindow } from "./home";
import { eventWindow } from "../lib/serverRefreshPolicy";
import type { CalendarEventData } from "../lib/calendarTimeline";

// buildConfig is mocked so tests can toggle isProduction without patching
// import.meta.env (vitest compiles PROD to a constant that can't be reassigned).
vi.mock("../lib/buildConfig", () => ({ isProduction: vi.fn(() => false) }));

const mocks = vi.hoisted(() => ({
  useShowTimeLapse: vi.fn(),
  useHiddenCalendars: vi.fn(),
  getDevFixtureCalendars: vi.fn(),
}));

vi.mock("../lib/persistentState", () => ({
  useShowTimeLapse: mocks.useShowTimeLapse,
  useHiddenCalendars: mocks.useHiddenCalendars,
}));
vi.mock("../lib/devFixture", () => ({
  getDevFixtureCalendars: mocks.getDevFixtureCalendars,
}));

// Server-only modules the loader imports dynamically. Mocking them keeps the
// real .server.ts files (which read process.env) out of the test bundle.
const serverMocks = vi.hoisted(() => ({
  getUserId: vi.fn(),
  getCalendarConnections: vi.fn(),
  readCalendarEvents: vi.fn(),
}));

vi.mock("../lib/session.server", () => ({ getUserId: serverMocks.getUserId }));
vi.mock("../lib/userRepository.server", () => ({
  userRepository: { getCalendarConnections: serverMocks.getCalendarConnections },
}));
vi.mock("../lib/calendarReader.server", () => ({
  readCalendarEvents: serverMocks.readCalendarEvents,
}));

import { isProduction } from "../lib/buildConfig";

interface LoaderData {
  serverCalendars: CalendarEventData[];
  failedCalendars: string[];
  view: string;
  ref: string;
}

const DEFAULT_LOADER_DATA: LoaderData = {
  serverCalendars: [],
  failedCalendars: [],
  view: "day",
  ref: "2026-06-20",
};

function SignInStub() {
  return <div data-testid="sign-in-page">Sign in</div>;
}

function makeStub(loaderData: LoaderData = DEFAULT_LOADER_DATA) {
  return createRoutesStub([
    { path: "/", Component: Home, loader: () => loaderData },
    { path: "/sign-in", Component: SignInStub },
    { path: "/settings", Component: () => <div>Settings</div> },
  ]);
}

const GOOGLE_EVENT = {
  id: "e1",
  calendarId: "google",
  title: "Standup",
  start: "2026-06-20T09:00:00.000Z",
  end: "2026-06-20T09:15:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useShowTimeLapse.mockReturnValue([false, vi.fn()]);
  mocks.useHiddenCalendars.mockReturnValue([]);
  mocks.getDevFixtureCalendars.mockReturnValue([]);
  vi.mocked(isProduction).mockReturnValue(false); // dev mode by default
});

describe("Home route — rendering", () => {
  it("renders timeline controls when loader data is available", async () => {
    const HomeStub = makeStub();
    render(<HomeStub initialEntries={["/"]} />);
    await screen.findByRole("group", { name: /time view/i });
    expect(screen.getByRole("group", { name: /time view/i })).toBeTruthy();
  });

  it("lays out the panel sections in reading order", async () => {
    const HomeStub = makeStub();
    render(<HomeStub initialEntries={["/"]} />);
    await screen.findByRole("group", { name: /time view/i });
    // The agenda's dated title appears once the client has mounted.
    await vi.waitFor(() => {
      const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
      expect(headings).toEqual(["All day", "Calendars", expect.stringMatching(/\d/)]);
    });
  });

  it("shows 'No calendars connected' when no calendars are linked", async () => {
    const HomeStub = makeStub();
    render(<HomeStub initialEntries={["/?ref=2026-06-20"]} />);
    await screen.findByText(/No calendars connected/i);
    expect(screen.getByText(/No calendars connected/i)).toBeTruthy();
  });

  it("prompts a reconnect when the server could not read a calendar", async () => {
    const HomeStub = makeStub({
      ...DEFAULT_LOADER_DATA,
      serverCalendars: [{ calendarId: "google", events: [], fetchedRange: null }],
      failedCalendars: ["google"],
    });
    render(<HomeStub initialEntries={["/"]} />);
    expect(await screen.findByText(/Calendar sync failed/i)).toBeTruthy();
  });

  it("leaves out calendars the user hid in Settings", async () => {
    mocks.useHiddenCalendars.mockReturnValue(["google"]);
    const HomeStub = makeStub({
      ...DEFAULT_LOADER_DATA,
      serverCalendars: [{ calendarId: "google", events: [GOOGLE_EVENT], fetchedRange: null }],
    });
    render(<HomeStub initialEntries={["/"]} />);
    // With the only calendar hidden the timeline falls back to the empty state.
    expect(await screen.findByText(/No calendars connected/i)).toBeTruthy();
  });
});

describe("Home route — local day and current time", () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    vi.useRealTimers();
    process.env.TZ = originalTz;
  });

  /** Freezes the clock (timers keep running) in the given time zone. */
  function at(tz: string, instant: string) {
    process.env.TZ = tz;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(instant));
  }

  /** Loader data with one empty calendar, so the circle has a ring to draw. */
  const withRing = (ref = "2026-06-23") => ({
    ...DEFAULT_LOADER_DATA,
    ref,
    serverCalendars: [{ calendarId: "google", events: [], fetchedRange: null }],
  });

  /** The centre label's lines once the client has mounted. */
  async function centreLabel() {
    await screen.findByRole("group", { name: /time view/i });
    await vi.waitFor(() => {
      expect(document.querySelector("[data-center-label]")).not.toBeNull();
    });
    return [...document.querySelectorAll("[data-center-label] text")].map((t) => t.textContent);
  }

  it("shows today's hand west of UTC, where the date key is not UTC midnight", async () => {
    // 14:20 PDT on 23 June is 21:20 UTC the same day.
    at("America/Los_Angeles", "2026-06-23T21:20:00Z");
    const HomeStub = makeStub(withRing());
    render(<HomeStub initialEntries={["/?ref=2026-06-23"]} />);

    expect((await centreLabel())[0]).toBe("14:20");
    expect(document.querySelector("[data-hand]")).not.toBeNull();
  });

  it("defaults to the local today after a positive-offset midnight", async () => {
    // 00:30 on 24 June in Helsinki is still 23 June in UTC, where the loader runs.
    at("Europe/Helsinki", "2026-06-23T21:30:00Z");
    const HomeStub = makeStub(withRing());
    render(<HomeStub initialEntries={["/"]} />);

    expect((await centreLabel())[0]).toBe("00:30");
    expect(document.querySelector("[data-hand]")).not.toBeNull();
  });

  it("shows another day's date without a hand", async () => {
    at("America/Los_Angeles", "2026-06-23T21:20:00Z");
    const HomeStub = makeStub(withRing());
    render(<HomeStub initialEntries={["/?ref=2026-06-25"]} />);

    expect((await centreLabel())[0]).toBe("25");
    expect(document.querySelector("[data-hand]")).toBeNull();
  });

  it("opens the same event detail from an agenda row and from its slice", async () => {
    at("Europe/Helsinki", "2026-06-23T11:20:00Z");
    const review = {
      id: "r1",
      calendarId: "google",
      title: "Design review",
      start: new Date(2026, 5, 23, 15).toISOString(),
      end: new Date(2026, 5, 23, 16, 30).toISOString(),
    };
    const HomeStub = makeStub({
      ...withRing(),
      serverCalendars: [{ calendarId: "google", events: [review], fetchedRange: null }],
    });
    render(<HomeStub initialEntries={["/?ref=2026-06-23"]} />);

    const row = await screen.findByRole("button", { name: /Design review/ });
    expect(row.textContent).toContain("Up next");
    fireEvent.click(row);
    const fromRow = screen.getByRole("dialog", { name: "Design review" });
    fireEvent.click(within(fromRow).getByRole("button", { name: /close/i }));
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Ring 1 segment 2/ }));
    expect(screen.getByRole("dialog", { name: "Design review" })).toBeTruthy();
  });

  it("shows the day's all-day events on the arch and as chips, not on the ring", async () => {
    at("Europe/Helsinki", "2026-06-23T11:20:00Z");
    const birthday = {
      id: "b1",
      calendarId: "google",
      title: "Mara's birthday",
      start: "2026-06-23T00:00:00.000Z",
      end: "2026-06-24T00:00:00.000Z",
      allDay: true,
      kind: "birthday" as const,
    };
    const HomeStub = makeStub({
      ...withRing(),
      serverCalendars: [{ calendarId: "google", events: [birthday], fetchedRange: null }],
    });
    render(<HomeStub initialEntries={["/?ref=2026-06-23"]} />);

    const arch = await screen.findByRole("img", { name: /All day: Mara's birthday \(birthday\)/ });
    expect(arch).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Ring 1 segment/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Mara's birthday (birthday)" }));
    expect(screen.getByRole("dialog", { name: "Mara's birthday" })).toBeTruthy();
  });

  it("steps to the next local day", async () => {
    at("Pacific/Auckland", "2026-06-23T11:00:00Z");
    const HomeStub = makeStub(withRing());
    render(<HomeStub initialEntries={["/?ref=2026-06-23"]} />);
    await centreLabel();

    fireEvent.click(screen.getByRole("button", { name: /next period/i }));

    await vi.waitFor(async () => expect((await centreLabel())[0]).toBe("24"));
  });
});

describe("Home route — hydration across a UTC-day boundary", () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    vi.useRealTimers();
    process.env.TZ = originalTz;
  });

  it("hydrates a UTC server render in a browser that is already on the next day", async () => {
    // 22:30 UTC on 3 October is 01:30 on 4 October in Helsinki.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-03T22:30:00Z"));
    const data = {
      ...DEFAULT_LOADER_DATA,
      ref: "2026-10-03",
      serverCalendars: [{ calendarId: "google", events: [], fetchedRange: null }],
    };
    const Stub = createRoutesStub([{ id: "home", path: "/", Component: Home, loader: () => data }]);
    const app = <Stub initialEntries={["/"]} hydrationData={{ loaderData: { home: data } }} />;

    process.env.TZ = "UTC";
    const html = renderToString(app);

    process.env.TZ = "Europe/Helsinki";
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    const recoverable = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await act(async () => {
        hydrateRoot(container, app, { onRecoverableError: recoverable });
      });

      expect(recoverable).not.toHaveBeenCalled();
      expect(consoleError.mock.calls.flat().join(" ")).not.toMatch(/hydrat/i);
      // After mounting, the browser's own day is shown.
      await vi.waitFor(() =>
        expect(container.querySelector("[data-center-label] text")?.textContent).toBe("01:30")
      );
    } finally {
      consoleError.mockRestore();
      container.remove();
    }
  });
});

describe("Home route — server auth gate", () => {
  it("redirects unauthenticated production requests before rendering the timeline", async () => {
    serverMocks.getUserId.mockResolvedValue(null);
    vi.mocked(isProduction).mockReturnValue(true);
    const request = new Request("http://localhost/");

    await expect(loader({ request } as Parameters<typeof loader>[0])).rejects.toMatchObject({
      status: 302,
      headers: expect.any(Headers),
    });
  });

  it("keeps the development fixture reachable without a session", async () => {
    serverMocks.getUserId.mockResolvedValue(null);
    vi.mocked(isProduction).mockReturnValue(false);
    const request = new Request("http://localhost/");

    await expect(loader({ request } as Parameters<typeof loader>[0])).resolves.toEqual(
      expect.objectContaining({ serverCalendars: [], failedCalendars: [] })
    );
    expect(serverMocks.readCalendarEvents).not.toHaveBeenCalled();
  });
});

describe("Home route — server data", () => {
  it("reads each connected calendar on the server for the view window", async () => {
    const connection = { id: "connection-1", provider: "google", providerUserId: "g" };
    serverMocks.getUserId.mockResolvedValue("user-1");
    serverMocks.getCalendarConnections.mockResolvedValue([connection]);
    serverMocks.readCalendarEvents.mockResolvedValue({
      calendar: { calendarId: "google", events: [GOOGLE_EVENT], fetchedRange: null },
      failed: false,
    });

    const result = await loader({
      request: new Request("http://localhost/?view=day&ref=2026-06-20"),
    } as Parameters<typeof loader>[0]);

    expect(serverMocks.readCalendarEvents).toHaveBeenCalledWith("user-1", connection, {
      start: expect.any(String),
      end: expect.any(String),
    });
    expect(result).toEqual(
      expect.objectContaining({
        serverCalendars: [{ calendarId: "google", events: [GOOGLE_EVENT], fetchedRange: null }],
        failedCalendars: [],
      })
    );
  });

  it("reports calendars whose server-side read failed", async () => {
    serverMocks.getUserId.mockResolvedValue("user-1");
    serverMocks.getCalendarConnections.mockResolvedValue([
      { id: "connection-1", provider: "google", providerUserId: "g" },
      { id: "connection-2", provider: "outlook", providerUserId: "o" },
    ]);
    serverMocks.readCalendarEvents
      .mockResolvedValueOnce({
        calendar: { calendarId: "google", events: [], fetchedRange: null },
        failed: false,
      })
      .mockResolvedValueOnce({
        calendar: { calendarId: "outlook", events: [], fetchedRange: null },
        failed: true,
      });

    const result = await loader({
      request: new Request("http://localhost/"),
    } as Parameters<typeof loader>[0]);

    expect(result).toEqual(expect.objectContaining({ failedCalendars: ["outlook"] }));
  });
});

describe("serverReadWindow", () => {
  it("covers the local view window in every time zone", () => {
    const reference = new Date("2026-10-01T12:00:00Z");
    const window = serverReadWindow("day", reference);
    const local = eventWindow("day", reference);

    // UTC+14 starts its day 14h before UTC midnight; UTC-12 ends it 12h after.
    expect(new Date(window.start).getTime()).toBeLessThanOrEqual(
      new Date(local.start).getTime() - 14 * 3_600_000
    );
    expect(new Date(window.end).getTime()).toBeGreaterThanOrEqual(
      new Date(local.end).getTime() + 12 * 3_600_000
    );
  });
});
