import type { CalendarEvent, CalendarProvider, TimeRange } from "../../types";
import { retryingFetch, type RetryOptions } from "../retryingFetch";
import { outlookEventKind } from "../../allDayKind";
import { ProviderHttpError } from "../../providerErrors";

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
  /** `free`, `tentative`, `busy`, `oof`, `workingElsewhere` or `unknown`. */
  showAs?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
}

interface GraphEventsResponse {
  value?: GraphEvent[];
  "@odata.nextLink"?: string;
}

/**
 * Upper bound on result pages per request. A range needing more pages fails
 * instead of returning a partial list that the cache would store as complete.
 */
export const OUTLOOK_MAX_PAGES = 20;

/** Only Graph's own origin receives the access token. */
const GRAPH_ORIGIN = new URL(EVENTS_ENDPOINT).origin;

function mapEvent(api: GraphEvent): CalendarEvent {
  return {
    id: api.id,
    calendarId: "outlook",
    title: api.subject ?? "(no subject)",
    // Graph returns local datetimes with a timezone; normalise to UTC ISO.
    start: new Date(api.start.dateTime + "Z").toISOString(),
    end: new Date(api.end.dateTime + "Z").toISOString(),
    allDay: api.isAllDay ?? false,
    kind: outlookEventKind(api.showAs),
  };
}

export interface OutlookProviderConfig {
  /** Supplies a valid access token; the server refreshes it when needed. */
  accessToken: () => Promise<string>;
  fetchFn?: typeof fetch;
  /** Overrides the retry defaults; tests use it to skip real waits. */
  retry?: RetryOptions;
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
    this.fetchFn = retryingFetch(config.fetchFn ?? fetch.bind(globalThis), config.retry);
  }

  /**
   * Returns every event in the range, following `@odata.nextLink` until the
   * last page. Each page is retried on a temporary failure. A next link
   * outside Microsoft Graph is rejected, so the access token is only sent to
   * Graph. Throws rather than return a partial list.
   */
  async fetchEvents(range: TimeRange): Promise<CalendarEvent[]> {
    const token = await this.accessToken();
    const first = new URL(EVENTS_ENDPOINT);
    first.searchParams.set("startDateTime", new Date(range.start).toISOString());
    first.searchParams.set("endDateTime", new Date(range.end).toISOString());
    first.searchParams.set("$select", "id,subject,isAllDay,showAs,start,end");
    first.searchParams.set("$top", "1000");
    first.searchParams.set("$orderby", "start/dateTime");

    const events: CalendarEvent[] = [];
    let url: string = first.toString();
    for (let page = 0; page < OUTLOOK_MAX_PAGES; page++) {
      const res = await this.fetchFn(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) {
        throw new ProviderHttpError("Outlook", res.status);
      }

      const data = (await res.json()) as GraphEventsResponse;
      events.push(...(data.value ?? []).filter((e) => e.start && e.end).map(mapEvent));
      const next = data["@odata.nextLink"];
      if (!next) return events;
      if (new URL(next).origin !== GRAPH_ORIGIN) {
        throw new Error("Outlook Calendar returned a next page outside Microsoft Graph");
      }
      url = next;
    }

    throw new Error(`Outlook Calendar fetch exceeded ${OUTLOOK_MAX_PAGES} pages`);
  }
}
