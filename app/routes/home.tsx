import type { Route } from "./+types/home";
import { useState, useMemo, useCallback, useEffect } from "react";
import { Link, useNavigate, useLoaderData, useSearchParams, useFetcher } from "react-router";
import { MultiCircle } from "../components/timeline";
import { SegmentedControl, type TimeView } from "../components/SegmentedControl";
import { PeriodNavigator } from "../components/PeriodNavigator";
import { DarkModeToggle } from "../components/DarkModeToggle";
import { EventDetail } from "../components/EventDetail";
import { slicesForViewOuterRing } from "../lib/timeSlices";
import { eventRingsForCalendars } from "../lib/calendarTimeline";
import { useCalendarTimeline } from "../lib/useCalendarTimeline";
import { useShowTimeLapse } from "../lib/persistentState";
import { useIsAuthenticated } from "../lib/authState";
import { isProduction } from "../lib/buildConfig";
import { getDevFixtureCalendars } from "../lib/devFixture";
import type { CalendarEvent, CalendarEventData } from "../lib/calendarTimeline";
import type { CacheEntry } from "../lib/useCalendarTimeline";
import {
  splitIntoMonthlyWindows,
  deduplicateEvents,
  eventWindow,
} from "../lib/serverRefreshPolicy";
import {
  page,
  header,
  settingsLink,
  timeline,
  emptyState,
  emptyStateLink,
  timeLapseToggle,
} from "./home.css";

export function meta() {
  return [
    { title: "Circular Time" },
    { name: "description", content: "Calendar events as circular timelines" },
  ];
}

/**
 * Reads calendar events from the server-side DB cache for the requested view
 * window. Returns events already aggregated from monthly cache entries.
 * When the user has no session or no connected calendars, returns an empty list.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const { getUserId } = await import("../lib/session.server");
  const { serverEventCache } = await import("../lib/serverEventCache.server");
  const { userRepository } = await import("../lib/userRepository.server");
  const userId = await getUserId(request);
  const url = new URL(request.url);
  const view = (url.searchParams.get("view") ?? "day") as TimeView;
  const refParam = url.searchParams.get("ref");
  const refDate = refParam ? new Date(refParam) : new Date();
  const ref = refDate.toISOString().slice(0, 10);

  if (!userId) {
    return { serverCalendars: [] as CalendarEventData[], view, ref };
  }

  const range = eventWindow(view, refDate);
  const windows = splitIntoMonthlyWindows(range);
  const providers = await userRepository.getConnectedProviders(userId);

  const serverCalendars: CalendarEventData[] = [];
  for (const provider of providers) {
    const events: CalendarEvent[] = [];
    let allCovered = true;
    for (const window of windows) {
      const entry = await serverEventCache.get(userId, provider, window);
      if (entry) events.push(...entry.events);
      else allCovered = false;
    }
    serverCalendars.push({
      calendarId: provider,
      events: deduplicateEvents(events),
      // Only set fetchedRange when all monthly windows are cached; otherwise
      // the timeline correctly shows "unknown" for the uncovered portions.
      fetchedRange: allCovered ? range : null,
    });
  }

  return { serverCalendars, view, ref };
}

// The action is an authenticated write surface, so the JSON body is untrusted
// until validated. `typeof null === "object"`, so every object field needs an
// explicit null check before it can be trusted as a CacheEntry.
function isValidCacheEntry(body: unknown): body is CacheEntry {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  if (typeof b.calendarId !== "string" || typeof b.fetchedAt !== "string") return false;
  if (!Array.isArray(b.events)) return false;
  if (typeof b.range !== "object" || b.range === null) return false;
  const r = b.range as Record<string, unknown>;
  return typeof r.start === "string" && typeof r.end === "string";
}

/**
 * Accepts a `CacheEntry` from the client after a successful provider fetch and
 * persists it to the server-side DB cache. React Router revalidates the loader
 * after this action completes, surfacing the warmed data on the next render.
 */
export async function action({ request }: Route.ActionArgs) {
  const { getUserId } = await import("../lib/session.server");
  const { serverEventCache } = await import("../lib/serverEventCache.server");
  const { userRepository } = await import("../lib/userRepository.server");
  const userId = await getUserId(request);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body: unknown = await request.json();
  if (!isValidCacheEntry(body)) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const connected = await userRepository.getConnectedProviders(userId);
  if (!connected.includes(body.calendarId)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await serverEventCache.set(userId, body);
  return Response.json({ ok: true });
}

export default function Home() {
  const { serverCalendars, view: loaderView, ref: loaderRef } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const isAuthenticated = useIsAuthenticated();
  const view = (searchParams.get("view") ?? loaderView) as TimeView;
  // ref falls back to loader default (today) when the URL has no param yet.
  const refStr = searchParams.get("ref") ?? loaderRef;
  const reference = useMemo(() => new Date(refStr), [refStr]);

  // Dev builds bypass the gate so the dev fixture is reachable without OAuth.
  useEffect(() => {
    if (!isAuthenticated && isProduction()) {
      navigate("/sign-in", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showTimeLapse, setShowTimeLapse] = useShowTimeLapse();

  // DB cache is cold when no connected calendar has a fetchedRange set.
  // This is true on first load before the client has warmed the server cache.
  const isColdCache =
    serverCalendars.length === 0 || serverCalendars.every((c) => c.fetchedRange === null);

  // After a successful provider fetch the hook calls this, which POSTs the
  // CacheEntry to the route action. React Router then revalidates the loader
  // automatically, turning the cold DB into a warm one for future navigations.
  const handleFetched = useCallback(
    (entry: CacheEntry) => {
      fetcher.submit(JSON.stringify(entry), {
        method: "POST",
        encType: "application/json",
      });
    },
    [fetcher]
  );

  // Hook is reduced to a cache warmer: fetches from provider APIs (using
  // browser tokens) and warms the server DB cache via the route action.
  // Disabled when the server already has fresh data for every connected calendar.
  const { calendars: hookCalendars, failedCalendars } = useCalendarTimeline(view, reference, {
    enabled: isColdCache,
    onFetched: handleFetched,
  });

  // Server data is authoritative when the DB cache is warm. The hook provides
  // an optimistic fallback while the server cache is being populated on first load.
  const calendars = isColdCache ? hookCalendars : serverCalendars;

  const activeCalendars = useMemo(
    () => (calendars.length === 0 ? getDevFixtureCalendars(reference, view) : calendars),
    [calendars, reference, view]
  );
  const noCalendars = activeCalendars.length === 0;

  const rings = [
    ...(showTimeLapse ? slicesForViewOuterRing(view, reference) : []),
    ...eventRingsForCalendars(activeCalendars, view, reference),
  ];

  const eventById = useMemo<Map<string, CalendarEvent>>(() => {
    const map = new Map<string, CalendarEvent>();
    for (const cal of activeCalendars) {
      for (const evt of cal.events) map.set(`${evt.calendarId}:${evt.id}`, evt);
    }
    return map;
  }, [activeCalendars]);

  function handleSliceClick(slice: { eventId?: string }) {
    if (!slice.eventId) return;
    const evt = eventById.get(slice.eventId);
    if (evt) setSelectedEvent(evt);
  }

  function handleViewChange(newView: TimeView) {
    setSearchParams(
      (prev) => {
        prev.set("view", newView);
        return prev;
      },
      { replace: true }
    );
  }

  function handleReferenceChange(date: Date) {
    setSearchParams(
      (prev) => {
        prev.set("ref", date.toISOString().slice(0, 10));
        return prev;
      },
      { replace: true }
    );
  }

  return (
    <main className={page}>
      <div className={header}>
        <DarkModeToggle />
        <Link to="/settings" className={settingsLink} aria-label="Settings">
          ⚙
        </Link>
      </div>
      <MultiCircle rings={rings} onSliceClick={handleSliceClick} className={timeline} />
      <PeriodNavigator view={view} value={reference} onChange={handleReferenceChange} />
      <SegmentedControl value={view} onChange={handleViewChange} />
      <label className={timeLapseToggle}>
        <input
          type="checkbox"
          checked={showTimeLapse}
          onChange={(e) => setShowTimeLapse(e.target.checked)}
        />
        show time lapse
      </label>
      {noCalendars && (
        <p className={emptyState}>
          No calendars connected.{" "}
          <Link to="/settings" className={emptyStateLink}>
            Open Settings
          </Link>{" "}
          to add one.
        </p>
      )}
      {failedCalendars.length > 0 && (
        <p className={emptyState}>
          Calendar sync failed.{" "}
          <Link to="/settings" className={emptyStateLink}>
            Reconnect in Settings
          </Link>
        </p>
      )}
      {selectedEvent && (
        <EventDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </main>
  );
}
