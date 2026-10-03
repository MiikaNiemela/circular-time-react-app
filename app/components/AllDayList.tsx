import type { AllDayItem } from "../lib/allDay";
import type { CalendarEvent } from "../data/types";
import { KindGlyph, KIND_COLOR, KIND_LABEL } from "./AllDayGlyph";
import { list, chip, icon, empty } from "./AllDayList.css";

export interface AllDayListProps {
  items: AllDayItem[];
  onSelect: (event: CalendarEvent) => void;
}

/** Every all-day event of the shown day as a chip; the arch may show fewer. */
export function AllDayList({ items, onSelect }: AllDayListProps) {
  if (items.length === 0) return <p className={empty}>No all-day events.</p>;
  return (
    <ul className={list}>
      {items.map((item) => (
        <li key={item.key}>
          <button
            type="button"
            className={chip}
            onClick={() => onSelect(item.event)}
            aria-label={`${item.title} (${KIND_LABEL[item.kind]})`}
          >
            <svg
              className={icon}
              width={22}
              height={22}
              viewBox="-11 -11 22 22"
              aria-hidden="true"
              style={{ color: KIND_COLOR[item.kind] }}
            >
              <circle r={10} fill="none" stroke="currentColor" strokeWidth={1.2} />
              <KindGlyph kind={item.kind} />
            </svg>
            {item.title}
          </button>
        </li>
      ))}
    </ul>
  );
}
