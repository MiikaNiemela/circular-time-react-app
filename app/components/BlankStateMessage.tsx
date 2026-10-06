import { Link } from "react-router";
import type { BlankState } from "../lib/blankState";
import { OAuthStartForm } from "./OAuthStartForm";
import { box, message, action } from "./BlankStateMessage.css";

export interface BlankStateMessageProps {
  state: BlankState;
  /** Display name of a calendar id. */
  calendarName: (calendarId: string) => string;
  /** Reloads the page's data, for "Try again". */
  onRetry: () => void;
}

/** Joins names as "A", "A and B", "A, B and C". */
function names(list: string[]): string {
  return list.length <= 1 ? (list[0] ?? "") : `${list.slice(0, -1).join(", ")} and ${list.at(-1)}`;
}

const isOAuthProvider = (id: string): id is "google" | "outlook" =>
  id === "google" || id === "outlook";

/** Says why the timeline is blank, or missing a calendar, and offers what to do. */
export function BlankStateMessage({ state, calendarName, onRetry }: BlankStateMessageProps) {
  switch (state.kind) {
    case "no-sources":
      return (
        <div className={box} role="status">
          <p className={message}>No calendars are connected yet.</p>
          <Link to="/settings" className={action}>
            Connect a source
          </Link>
        </div>
      );
    case "all-hidden":
      return (
        <div className={box} role="status">
          <p className={message}>All your calendars are hidden.</p>
          <Link to="/settings" className={action}>
            Choose calendars to show
          </Link>
        </div>
      );
    case "reconnect":
      return (
        <div className={box} role="status">
          <p className={message}>
            {names(state.calendarIds.map(calendarName))} needs to be connected again before its
            events can be shown.
          </p>
          {state.calendarIds.filter(isOAuthProvider).map((id) => (
            <OAuthStartForm
              key={id}
              provider={id}
              intent="connect-calendar"
              label={`Reconnect ${calendarName(id)}`}
              className={action}
            >
              {state.calendarIds.length > 1 ? `Reconnect ${calendarName(id)}` : "Reconnect"}
            </OAuthStartForm>
          ))}
        </div>
      );
    case "unavailable":
      return (
        <div className={box} role="status">
          <p className={message}>
            {names(state.calendarIds.map(calendarName))} could not be reached, and nothing is saved
            for this period yet.
          </p>
          <button type="button" className={action} onClick={onRetry}>
            Try again
          </button>
        </div>
      );
    case "no-events":
      return (
        <div className={box} role="status">
          <p className={message}>No events in this period.</p>
        </div>
      );
  }
}
