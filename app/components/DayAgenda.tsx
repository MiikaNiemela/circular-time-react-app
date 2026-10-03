import { useState } from "react";
import type { AgendaItem } from "../lib/dayAgenda";
import type { CalendarEvent } from "../data/types";
import {
  list,
  collapsed as collapsedClass,
  row,
  button,
  time,
  dot,
  title,
  meta,
  upNext as upNextClass,
  empty,
  toggle,
} from "./DayAgenda.css";

export interface DayAgendaProps {
  items: AgendaItem[];
  /** Display name of an event's calendar. */
  calendarName: (calendarId: string) => string;
  /** Called when a row is selected. */
  onSelect: (event: CalendarEvent) => void;
}

/**
 * The shown day's timed events. Past events are de-emphasised and the next
 * one is marked. On narrow layouts past events stay hidden until the list is
 * expanded; the wide layout always shows the full day.
 */
export function DayAgenda({ items, calendarName, onSelect }: DayAgendaProps) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return <p className={empty}>No timed events.</p>;

  const pastCount = items.filter((i) => i.past).length;
  return (
    <>
      <ul className={`${list} ${expanded ? "" : collapsedClass}`}>
        {items.map((item) => (
          <li key={item.key} className={row} data-past={item.past}>
            <button type="button" className={button} onClick={() => onSelect(item.event)}>
              <span className={time}>{item.time}</span>
              <span className={dot} style={{ background: item.color }} aria-hidden="true" />
              <span className={title}>
                {item.upNext && <span className={upNextClass}>Up next</span>}
                {item.event.title}
              </span>
              <span className={meta}>
                {[
                  item.startedEarlier && "started earlier",
                  item.endsLater && "ends later",
                  calendarName(item.event.calendarId),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {pastCount > 0 && (
        <button type="button" className={toggle} onClick={() => setExpanded((e) => !e)}>
          {expanded ? "Show upcoming only" : `Show full day (${pastCount} earlier)`}
        </button>
      )}
    </>
  );
}
