import type { CalendarEvent, CalendarProvider, TimeRange } from "../../types";
import { OutlookTokenStore } from "./tokenStore";
import { refreshAccessToken } from "./auth";

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
  clientId: string;
  tokenStore?: OutlookTokenStore;
  fetchFn?: typeof fetch;
}

export class OutlookCalendarProvider implements CalendarProvider {
  readonly id = "outlook";
  readonly name = "Outlook / Microsoft 365";

  private readonly clientId: string;
  private readonly tokenStore: OutlookTokenStore;
  private readonly fetchFn: typeof fetch;

  constructor(config: OutlookProviderConfig) {
    this.clientId = config.clientId;
    this.tokenStore = config.tokenStore ?? new OutlookTokenStore();
    // bind prevents "Illegal invocation" when fetch is called as a method
    this.fetchFn = config.fetchFn ?? fetch.bind(globalThis);
  }

  private async accessToken(): Promise<string> {
    console.debug("fetching Outlook access token...");
    let tokens = this.tokenStore.get();
    if (!tokens) {
      console.error("Outlook Calendar is not connected");
      throw new Error("Outlook Calendar is not connected");
    }

    if (this.tokenStore.isExpired()) {
      console.debug("Outlook access token expired; refreshing...");
      if (!tokens.refreshToken) {
        console.error("Outlook session expired; reconnect required");
        throw new Error("Outlook session expired; reconnect required");
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
      console.error(`Outlook Calendar fetch failed: ${res.status}`);
      throw new Error(`Outlook Calendar fetch failed: ${res.status}`);
    }

    const data = (await res.json()) as GraphEventsResponse;
    console.debug(`Outlook Calendar API returned ${data.value?.length ?? 0} events`);
    return (data.value ?? []).filter((e) => e.start && e.end).map(mapEvent);
  }
}
