import type { CalendarEvent, CalendarProvider, TimeRange } from "../../types";

/**
 * Microsoft Graph API endpoint for the user's default calendar view.
 * `calendarView` expands recurring events across the requested time window,
 * matching the behaviour of Google's `singleEvents=true`.
 */
const EVENTS_ENDPOINT = "https://graph.microsoft.com/v1.0/me/calendarView";

interface GraphEvent {
  id: string;
  subject?: string;
  isAllDay?: boolean;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
}

interface GraphEventsResponse {
  value?: GraphEvent[];
}

function mapEvent(api: GraphEvent): CalendarEvent {
  return {
    id: api.id,
    calendarId: "outlook",
    title: api.subject ?? "(no subject)",
    // Graph returns local datetimes with a timezone; normalise to UTC ISO.
    start: new Date(api.start.dateTime + "Z").toISOString(),
    end: new Date(api.end.dateTime + "Z").toISOString(),
    allDay: api.isAllDay ?? false,
  };
}

export interface OutlookProviderConfig {
  /** Supplies a valid access token; the server refreshes it when needed. */
  accessToken: () => Promise<string>;
  fetchFn?: typeof fetch;
}

/**
 * Reads events from the user's default Outlook calendar. Credential custody
 * and refresh live on the server; this provider only asks for a valid token.
 */
export class OutlookCalendarProvider implements CalendarProvider {
  readonly id = "outlook";
  readonly name = "Outlook / Microsoft 365";

  private readonly accessToken: () => Promise<string>;
  private readonly fetchFn: typeof fetch;

  constructor(config: OutlookProviderConfig) {
    this.accessToken = config.accessToken;
    // bind prevents "Illegal invocation" when fetch is called as a method
    this.fetchFn = config.fetchFn ?? fetch.bind(globalThis);
  }

  async fetchEvents(range: TimeRange): Promise<CalendarEvent[]> {
    const token = await this.accessToken();
    const url = new URL(EVENTS_ENDPOINT);
    url.searchParams.set("startDateTime", new Date(range.start).toISOString());
    url.searchParams.set("endDateTime", new Date(range.end).toISOString());
    url.searchParams.set("$select", "id,subject,isAllDay,start,end");
    url.searchParams.set("$top", "1000");
    url.searchParams.set("$orderby", "start/dateTime");

    const res = await this.fetchFn(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      throw new Error(`Outlook Calendar fetch failed: ${res.status}`);
    }

    const data = (await res.json()) as GraphEventsResponse;
    return (data.value ?? []).filter((e) => e.start && e.end).map(mapEvent);
  }
}
