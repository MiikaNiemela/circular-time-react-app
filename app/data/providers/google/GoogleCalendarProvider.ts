import type { CalendarEvent, CalendarProvider, TimeRange } from "../../types";
import { retryingFetch, type RetryOptions } from "../retryingFetch";
import { googleAllDayKind } from "../../allDayKind";

const EVENTS_ENDPOINT = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

/** Shape of the Calendar API event resource fields we consume. */
interface GoogleApiEvent {
  id: string;
  summary?: string;
  colorId?: string;
  /** `default`, `birthday`, `outOfOffice`, `focusTime`, … */
  eventType?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
}

interface GoogleApiEventsList {
  items?: GoogleApiEvent[];
  nextPageToken?: string;
}

interface GoogleApiError {
  error?: { errors?: Array<{ reason?: string }> };
}

/** Google reports some rate limiting as a 403 with one of these reasons. */
const RATE_LIMIT_REASONS = new Set(["rateLimitExceeded", "userRateLimitExceeded"]);

async function isRateLimited(res: Response): Promise<boolean> {
  if (res.status !== 403) return false;
  try {
    const body = (await res.clone().json()) as GoogleApiError;
    return (body.error?.errors ?? []).some((e) => RATE_LIMIT_REASONS.has(e.reason ?? ""));
  } catch {
    return false;
  }
}

/**
 * Upper bound on result pages per request. A range needing more pages fails
 * instead of returning a partial list that the cache would store as complete.
 */
export const GOOGLE_MAX_PAGES = 20;

/** Maps a Google API event into our normalised `CalendarEvent`. */
function mapEvent(api: GoogleApiEvent): CalendarEvent {
  // All-day events use `date`; timed events use `dateTime`.
  const allDay = api.start.date != null;
  const start = api.start.dateTime ?? api.start.date!;
  const end = api.end.dateTime ?? api.end.date!;
  return {
    id: api.id,
    calendarId: "google",
    title: api.summary ?? "(no title)",
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
    allDay,
    ...(allDay ? { kind: googleAllDayKind(api.eventType) } : {}),
  };
}

export interface GoogleProviderConfig {
  /** Supplies a valid access token; the server refreshes it when needed. */
  accessToken: () => Promise<string>;
  fetchFn?: typeof fetch;
  /** Overrides the retry defaults; tests use it to skip real waits. */
  retry?: RetryOptions;
}

/**
 * Reads events from the user's primary Google Calendar. Credential custody
 * and refresh live on the server; this provider only asks for a valid token.
 */
export class GoogleCalendarProvider implements CalendarProvider {
  readonly id = "google";
  readonly name = "Google Calendar";

  private readonly accessToken: () => Promise<string>;
  private readonly fetchFn: typeof fetch;

  constructor(config: GoogleProviderConfig) {
    this.accessToken = config.accessToken;
    // bind prevents "Illegal invocation" when fetch is called as a method
    this.fetchFn = retryingFetch(config.fetchFn ?? fetch.bind(globalThis), {
      ...config.retry,
      isRetryable: isRateLimited,
    });
  }

  /**
   * Returns every event in the range, following `nextPageToken` until the
   * last page. Each page is retried on a temporary failure. Throws rather
   * than return a partial list.
   */
  async fetchEvents(range: TimeRange): Promise<CalendarEvent[]> {
    const token = await this.accessToken();
    const events: CalendarEvent[] = [];
    let pageToken: string | undefined;

    for (let page = 0; page < GOOGLE_MAX_PAGES; page++) {
      const url = new URL(EVENTS_ENDPOINT);
      url.searchParams.set("timeMin", new Date(range.start).toISOString());
      url.searchParams.set("timeMax", new Date(range.end).toISOString());
      // Expand recurring events into instances and order them for slicing.
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("orderBy", "startTime");
      url.searchParams.set("maxResults", "2500");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const res = await this.fetchFn(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error(`Google Calendar fetch failed: ${res.status}`);
      }

      const data = (await res.json()) as GoogleApiEventsList;
      events.push(...(data.items ?? []).filter((e) => e.start && e.end).map(mapEvent));
      if (!data.nextPageToken) return events;
      pageToken = data.nextPageToken;
    }

    throw new Error(`Google Calendar fetch exceeded ${GOOGLE_MAX_PAGES} pages`);
  }
}
