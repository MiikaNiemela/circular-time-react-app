import type { CalendarEvent, CalendarProvider, TimeRange } from "../../types";
import { GoogleTokenStore } from "./tokenStore";
import { refreshAccessToken } from "./auth";

const EVENTS_ENDPOINT = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

/** Shape of the Calendar API event resource fields we consume. */
interface GoogleApiEvent {
  id: string;
  summary?: string;
  colorId?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
}

interface GoogleApiEventsList {
  items?: GoogleApiEvent[];
}

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
  };
}

export interface GoogleProviderConfig {
  /** Public OAuth client ID (from build-time env / GitHub secret). */
  clientId: string;
  tokenStore?: GoogleTokenStore;
  fetchFn?: typeof fetch;
}

/**
 * Reads events from the user's primary Google Calendar.
 *
 * Auth is handled out of band (the OAuth callback writes tokens into the
 * store). This provider only reads tokens, refreshing the access token when it
 * has expired before each fetch.
 */
export class GoogleCalendarProvider implements CalendarProvider {
  readonly id = "google";
  readonly name = "Google Calendar";

  private readonly clientId: string;
  private readonly tokenStore: GoogleTokenStore;
  private readonly fetchFn: typeof fetch;

  constructor(config: GoogleProviderConfig) {
    this.clientId = config.clientId;
    this.tokenStore = config.tokenStore ?? new GoogleTokenStore();
    // bind prevents "Illegal invocation" when fetch is called as a method
    this.fetchFn = config.fetchFn ?? fetch.bind(globalThis);
  }

  /** Returns a valid access token, refreshing it first if expired. */
  private async accessToken(): Promise<string> {
    console.debug("checking Google access token...");
    let tokens = this.tokenStore.get();
    if (!tokens) {
      console.error("Google Calendar is not connected");
      throw new Error("Google Calendar is not connected");
    }

    if (this.tokenStore.isExpired()) {
      if (!tokens.refreshToken) {
        console.error("Google session expired; reconnect required");
        throw new Error("Google session expired; reconnect required");
      }
      tokens = await refreshAccessToken({
        clientId: this.clientId,
        refreshToken: tokens.refreshToken,
        fetchFn: this.fetchFn,
      });
      this.tokenStore.set(tokens);
    }
    return tokens.accessToken;
  }

  async fetchEvents(range: TimeRange): Promise<CalendarEvent[]> {
    console.debug(`fetching Google Calendar events for range ${range.start} to ${range.end}...`);
    const token = await this.accessToken();

    const url = new URL(EVENTS_ENDPOINT);
    url.searchParams.set("timeMin", new Date(range.start).toISOString());
    url.searchParams.set("timeMax", new Date(range.end).toISOString());
    // Expand recurring events into instances and order them for slicing.
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("maxResults", "2500");
    console.debug(`Google Calendar API request URL: ${url.toString()}`);
    const res = await this.fetchFn(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.debug(`Google Calendar API response status: ${res.status}`);
    if (!res.ok) {
      console.error(`Google Calendar fetch failed: ${res.status}`);
      throw new Error(`Google Calendar fetch failed: ${res.status}`);
    }

    const data = (await res.json()) as GoogleApiEventsList;
    console.debug(`Google Calendar API returned ${data.items?.length ?? 0} events`);
    return (data.items ?? []).filter((e) => e.start && e.end).map(mapEvent);
  }
}
