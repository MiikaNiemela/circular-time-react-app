import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import Home, { action, loader } from "./home";
import type { CalendarEventData } from "../lib/calendarTimeline";

// Provider configs — keep tests free of env-var dependencies.
vi.mock("../data/providers/google/config", () => ({
  GOOGLE_CLIENT_ID: "test-google-id",
  googleRedirectUri: (o: string) => `${o}/auth/google/callback`,
  isGoogleConfigured: () => true,
}));
vi.mock("../data/providers/outlook/config", () => ({
  OUTLOOK_CLIENT_ID: "test-outlook-id",
  outlookRedirectUri: (o: string) => `${o}/auth/outlook/callback`,
  isOutlookConfigured: () => true,
}));

// buildConfig is mocked so tests can toggle isProduction without patching
// import.meta.env (vitest compiles PROD to a constant that can't be reassigned).
vi.mock("../lib/buildConfig", () => ({ isProduction: vi.fn(() => false) }));

const mocks = vi.hoisted(() => ({
  useShowTimeLapse: vi.fn(),
  useCalendarTimeline: vi.fn(),
  getDevFixtureCalendars: vi.fn(),
}));

vi.mock("../lib/persistentState", () => ({
  useShowTimeLapse: mocks.useShowTimeLapse,
}));
vi.mock("../lib/useCalendarTimeline", () => ({
  useCalendarTimeline: mocks.useCalendarTimeline,
}));
vi.mock("../lib/devFixture", () => ({
  getDevFixtureCalendars: mocks.getDevFixtureCalendars,
}));

// Server-only modules the loader/action import dynamically. Mocking them keeps
// the real .server.ts files (which read process.env) out of the test bundle.
const serverMocks = vi.hoisted(() => ({
  getUserId: vi.fn(),
  cacheSet: vi.fn(),
  cacheGet: vi.fn(),
  getConnectedProviders: vi.fn(),
}));

vi.mock("../lib/session.server", () => ({ getUserId: serverMocks.getUserId }));
vi.mock("../lib/serverEventCache.server", () => ({
  serverEventCache: { set: serverMocks.cacheSet, get: serverMocks.cacheGet },
}));
vi.mock("../lib/userRepository.server", () => ({
  userRepository: { getConnectedProviders: serverMocks.getConnectedProviders },
}));

import { isProduction } from "../lib/buildConfig";

const DEFAULT_LOADER_DATA: { serverCalendars: CalendarEventData[]; view: string; ref: string } = {
  serverCalendars: [],
  view: "day",
  ref: "2026-06-20",
};

function SignInStub() {
  return <div data-testid="sign-in-page">Sign in</div>;
}

function makeStub(loaderData = DEFAULT_LOADER_DATA) {
  return createRoutesStub([
    { path: "/", Component: Home, loader: () => loaderData },
    { path: "/sign-in", Component: SignInStub },
    { path: "/settings", Component: () => <div>Settings</div> },
  ]);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useShowTimeLapse.mockReturnValue([false, vi.fn()]);
  mocks.useCalendarTimeline.mockReturnValue({ calendars: [], failedCalendars: [] });
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
      expect.objectContaining({ serverCalendars: [] })
    );
  });
});

describe("Home route — server data", () => {
  it("uses server calendars from loader when DB cache is warm", async () => {
    const serverCalendars = [
      {
        calendarId: "google",
        events: [],
        fetchedRange: { start: "2026-06-20T00:00:00Z", end: "2026-06-21T00:00:00Z" },
      },
    ];
    const HomeStub = makeStub({ serverCalendars, view: "day", ref: "2026-06-20" });
    render(<HomeStub initialEntries={["/"]} />);
    await screen.findByRole("group", { name: /time view/i });
    // When server has fresh data, hook is disabled (enabled: false)
    expect(mocks.useCalendarTimeline).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Date),
      expect.objectContaining({ enabled: false })
    );
  });

  it("enables the hook when DB cache is cold (no fetchedRange on any calendar)", async () => {
    const serverCalendars = [{ calendarId: "google", events: [], fetchedRange: null }];
    const HomeStub = makeStub({ serverCalendars, view: "day", ref: "2026-06-20" });
    render(<HomeStub initialEntries={["/"]} />);
    await screen.findByRole("group", { name: /time view/i });
    expect(mocks.useCalendarTimeline).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Date),
      expect.objectContaining({ enabled: true })
    );
  });
});

describe("Home route — action", () => {
  const validEntry = {
    calendarId: "google",
    range: { start: "2026-06-20T00:00:00Z", end: "2026-06-21T00:00:00Z" },
    events: [],
    fetchedAt: "2026-06-20T10:00:00Z",
  };

  function runAction(body: unknown) {
    const request = new Request("http://localhost/", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
    return action({ request } as Parameters<typeof action>[0]);
  }

  beforeEach(() => {
    serverMocks.getUserId.mockResolvedValue("user-1");
    serverMocks.getConnectedProviders.mockResolvedValue(["google"]);
    serverMocks.cacheSet.mockResolvedValue(undefined);
  });

  it("returns 401 and does not write when the request has no authenticated user", async () => {
    serverMocks.getUserId.mockResolvedValue(null);
    const res = await runAction(validEntry);
    expect(res.status).toBe(401);
    expect(serverMocks.cacheSet).not.toHaveBeenCalled();
  });

  it("returns 400 when the payload is missing required fields", async () => {
    const res = await runAction({ calendarId: "google" });
    expect(res.status).toBe(400);
    expect(serverMocks.cacheSet).not.toHaveBeenCalled();
  });

  it("returns 400 when range is null (typeof null === 'object' must not pass)", async () => {
    const res = await runAction({ ...validEntry, range: null });
    expect(res.status).toBe(400);
    expect(serverMocks.cacheSet).not.toHaveBeenCalled();
  });

  it("returns 403 when calendarId is not one of the user's connected providers", async () => {
    serverMocks.getConnectedProviders.mockResolvedValue(["outlook"]);
    const res = await runAction(validEntry);
    expect(res.status).toBe(403);
    expect(serverMocks.cacheSet).not.toHaveBeenCalled();
  });

  it("persists the entry and returns 200 for a valid authorized payload", async () => {
    const res = await runAction(validEntry);
    expect(res.status).toBe(200);
    expect(serverMocks.cacheSet).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ calendarId: "google" })
    );
  });
});
