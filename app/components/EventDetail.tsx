import { useEffect, useRef } from "react";
import type { CalendarEvent } from "../lib/calendarTimeline";
import { overlay, card, swatch, info, eventTitle, eventTime, closeBtn } from "./EventDetail.css";

/** Props for the EventDetail overlay. */
export interface EventDetailProps {
  /** The calendar event to display. */
  event: CalendarEvent;
  /** Called when the user dismisses the overlay. */
  onClose: () => void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** Bottom-anchored overlay that shows the title, date, and time range of a calendar event. */
export function EventDetail({ event, onClose }: EventDetailProps) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Move focus into the dialog on mount (ARIA dialog pattern / WCAG 2.1 SC 2.4.3).
  useEffect(() => {
    closeBtnRef.current?.focus();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") onClose();
  }

  const startDate = formatDate(event.start);
  const timeRange = event.allDay
    ? "All day"
    : `${formatTime(event.start)} – ${formatTime(event.end)}`;

  return (
    <div className={overlay} aria-live="polite">
      <div
        className={card}
        role="dialog"
        aria-label={event.title}
        aria-modal="true"
        onKeyDown={handleKeyDown}
      >
        <span
          className={swatch}
          style={{ background: event.color ?? "#f59e0b" }}
          aria-hidden="true"
          data-testid="event-swatch"
        />
        <div className={info}>
          <p className={eventTitle}>{event.title}</p>
          <p className={eventTime}>
            {startDate} · {timeRange}
          </p>
        </div>
        <button
          type="button"
          className={closeBtn}
          onClick={onClose}
          aria-label="Close"
          ref={closeBtnRef}
        >
          ×
        </button>
      </div>
    </div>
  );
}
