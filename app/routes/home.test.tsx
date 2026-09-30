import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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
