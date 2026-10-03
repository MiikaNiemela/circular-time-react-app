import { list, item, glyph, label as labelClass, meta } from "./CalendarLegend.css";

/** One calendar ring in the legend. */
export interface LegendItem {
  id: string;
  label: string;
}

export interface CalendarLegendProps {
  /** Calendars in ring order, outermost first. */
  items: LegendItem[];
}

const GLYPH_RINGS = 3;

/** A small concentric-ring mark with ring `index` (0 = outermost) filled in. */
function RingGlyph({ index, total }: { index: number; total: number }) {
  const shown = Math.min(Math.max(total, 1), GLYPH_RINGS);
  const active = Math.min(index, shown - 1);
  return (
    <svg className={glyph} width={18} height={18} viewBox="0 0 18 18" aria-hidden="true">
      {Array.from({ length: shown }, (_, i) => (
        <circle
          key={i}
          cx={9}
          cy={9}
          r={8 - i * 3}
          fill="none"
          stroke="currentColor"
          strokeWidth={i === active ? 2.5 : 1}
          strokeOpacity={i === active ? 1 : 0.3}
        />
      ))}
    </svg>
  );
}

function ringName(index: number, total: number): string {
  if (total === 1) return "Ring";
  if (index === 0) return "Outer ring";
  if (index === total - 1) return "Inner ring";
  return `Ring ${index + 1}`;
}

/**
 * Names the calendar behind each event ring. Events keep their own colours,
 * so the legend identifies a calendar by its ring position.
 */
export function CalendarLegend({ items }: CalendarLegendProps) {
  return (
    <ul className={list}>
      {items.map((it, index) => (
        <li key={it.id} className={item}>
          <RingGlyph index={index} total={items.length} />
          <span className={labelClass}>{it.label}</span>
          <span className={meta}>{ringName(index, items.length)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Display name for a calendar id. */
export function calendarLabel(calendarId: string): string {
  switch (calendarId) {
    case "google":
      return "Google Calendar";
    case "outlook":
      return "Outlook";
    default:
      // The development fixture's calendars are "dev-google" and "dev-outlook".
      return calendarId.startsWith("dev-")
        ? `${calendarLabel(calendarId.slice(4))} (sample)`
        : calendarId;
  }
}
