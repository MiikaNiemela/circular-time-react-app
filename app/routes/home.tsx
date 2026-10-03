import type { Route } from "./+types/home";
import { useState, useMemo } from "react";
import { Link, redirect, useLoaderData, useSearchParams } from "react-router";
import { MultiCircle } from "../components/timeline";
import { SegmentedControl, type TimeView } from "../components/SegmentedControl";
import { PeriodNavigator } from "../components/PeriodNavigator";
import { DarkModeToggle } from "../components/DarkModeToggle";
import { EventDetail } from "../components/EventDetail";
import { slicesForViewOuterRing } from "../lib/timeSlices";
import { eventRingsForCalendars } from "../lib/calendarTimeline";
import { useHiddenCalendars, useShowTimeLapse } from "../lib/persistentState";
import { isProduction } from "../lib/buildConfig";
import { getDevFixtureCalendars } from "../lib/devFixture";
import type { CalendarEvent, CalendarEventData } from "../lib/calendarTimeline";
import { eventWindow } from "../lib/serverRefreshPolicy";
import { dayClock } from "../lib/dayClock";
import { useNow } from "../lib/useNow";
import { formatLocalDate, parseLocalDate } from "../lib/localDate";
import { vars } from "../styles/theme.css";
import type { TimeRange } from "../data/types";
import { TimelineLayout } from "../components/TimelineLayout";
import { CalendarLegend, calendarLabel } from "../components/CalendarLegend";
import { settingsLink, timeline, emptyState, emptyStateLink, timeLapseToggle } from "./home.css";

export function meta() {
  return [
    { title: "Circular Time" },
    { name: "description", content: "Calendar events as circular timelines" },
  ];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The window the server reads for a view. The server does not know the
 * browser's time zone (Cloud Run runs in UTC), so the view window is widened
 * by a day on each side; that covers every UTC offset, and the browser clips
 * events to its local view window when it renders them.
 */
export function serverReadWindow(view: TimeView, reference: Date): TimeRange {
  const window = eventWindow(view, reference);
  return {
    start: new Date(new Date(window.start).getTime() - DAY_MS).toISOString(),
    end: new Date(new Date(window.end).getTime() + DAY_MS).toISOString(),
  };
}

/**
 * Serves calendar events for the requested view window. Each connected
 * calendar is read through the server-side cache: fresh monthly windows come
 * from the database, stale or missing ones are fetched from the provider with
 * the account's server-held credentials. A calendar whose credentials are
 * missing, expired, or revoked is reported in `failedCalendars` and falls back
 * to whatever is cached.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const { getUserId } = await import("../lib/session.server");
  const userId = await getUserId(request);
  const url = new URL(request.url);
  const view = (url.searchParams.get("view") ?? "day") as TimeView;
  const refParam = url.searchParams.get("ref");
  const refDate = (refParam && parseLocalDate(refParam)) || new Date();
  const ref = formatLocalDate(refDate);

  if (!userId) {
    if (isProduction()) throw redirect("/sign-in");
    return {
      serverCalendars: [] as CalendarEventData[],
      failedCalendars: [] as string[],
      view,
      ref,
    };
  }

  const { userRepository } = await import("../lib/userRepository.server");
  const { readCalendarEvents } = await import("../lib/calendarReader.server");
  const calendarConnections = await userRepository.getCalendarConnections(userId);
  const range = serverReadWindow(view, refDate);
  const results = await Promise.all(
    calendarConnections.map((connection) => readCalendarEvents(userId, connection, range))
  );
  return {
    serverCalendars: results.map((result) => result.calendar),
    failedCalendars: results.filter((result) => result.failed).map((r) => r.calendar.calendarId),
    view,
    ref,
  };
}

export default function Home() {
  const {
    serverCalendars,
    failedCalendars,
    view: loaderView,
    ref: loaderRef,
  } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const view = (searchParams.get("view") ?? loaderView) as TimeView;
  // Null until the client has mounted, so nothing here depends on the
  // server's clock or time zone.
  const now = useNow();
  // `ref` is a local calendar day. Without one the view shows the user's
  // local today, which the server (in UTC) cannot know; until the client has
  // mounted it uses the loader's day.
  const refParam = searchParams.get("ref");
  const refKey =
    (refParam && parseLocalDate(refParam) && refParam) || (now ? formatLocalDate(now) : loaderRef);
  // refKey is always a valid date key (an accepted ref, the client's today, or
  // the loader's formatted day), so no clock is read during render.
  const reference = useMemo(() => parseLocalDate(refKey)!, [refKey]);

  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showTimeLapse, setShowTimeLapse] = useShowTimeLapse();
  const hiddenCalendars = useHiddenCalendars();

  // The server reads every connected calendar; hiding one is a browser preference.
  const calendars = useMemo(
    () => serverCalendars.filter((calendar) => !hiddenCalendars.includes(calendar.calendarId)),
    [serverCalendars, hiddenCalendars]
  );

  const activeCalendars = useMemo(
    () => (calendars.length === 0 ? getDevFixtureCalendars(reference, view) : calendars),
    [calendars, reference, view]
  );
  const noCalendars = activeCalendars.length === 0;

  const clock = now ? dayClock(view, reference, now) : null;

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
        prev.set("ref", formatLocalDate(date));
        return prev;
      },
      { replace: true }
    );
  }

  const legendItems = activeCalendars.map((calendar) => ({
    id: calendar.calendarId,
    label: calendarLabel(calendar.calendarId),
  }));

  return (
    <>
      <TimelineLayout
        brand={
          <>
            <BrandMark />
            <span>Circular Time</span>
          </>
        }
        actions={
          <>
            <DarkModeToggle />
            <Link to="/settings" className={settingsLink} aria-label="Settings">
              ⚙
            </Link>
          </>
        }
        controls={
          <>
            <SegmentedControl value={view} onChange={handleViewChange} />
            <PeriodNavigator
              view={view}
              value={reference}
              onChange={handleReferenceChange}
              // Before mount, compare against the displayed day itself: the server
              // and the browser can be on different days, and the Today control
              // must render the same on both. The real time takes over after mount.
              now={now ?? reference}
            />
          </>
        }
        circle={
          <>
            <MultiCircle
              rings={rings}
              onSliceClick={handleSliceClick}
              className={timeline}
              hand={
                clock?.handDegrees !== undefined
                  ? { degrees: clock.handDegrees, color: vars.color.now }
                  : undefined
              }
              centerLabel={
                clock
                  ? {
                      primary: clock.primary,
                      secondary: clock.secondary,
                      color: vars.color.text,
                      secondaryColor: vars.color.textMuted,
                      haloColor: vars.color.background,
                      fontFamily: vars.font.mono,
                    }
                  : undefined
              }
            />
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
          </>
        }
        sections={[
          {
            id: "calendars",
            title: "Calendars",
            content: (
              <>
                {legendItems.length > 0 && <CalendarLegend items={legendItems} />}
                <label className={timeLapseToggle}>
                  <input
                    type="checkbox"
                    checked={showTimeLapse}
                    onChange={(e) => setShowTimeLapse(e.target.checked)}
                  />
                  show time lapse
                </label>
              </>
            ),
          },
        ]}
      />
      {selectedEvent && (
        <EventDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </>
  );
}

/** The product mark: a ring with a gap at the top. */
function BrandMark() {
  return (
    <svg width={22} height={22} viewBox="0 0 22 22" aria-hidden="true">
      <circle cx={11} cy={11} r={8.5} fill="none" stroke="currentColor" strokeWidth={3} />
      <circle
        cx={11}
        cy={11}
        r={8.5}
        fill="none"
        stroke={vars.color.accent}
        strokeWidth={3}
        strokeDasharray="18 100"
        transform="rotate(-90 11 11)"
      />
    </svg>
  );
}
