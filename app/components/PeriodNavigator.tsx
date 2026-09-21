import type { TimeView } from "./SegmentedControl";
import { stepPeriod, periodLabel, isSamePeriod } from "../lib/timeNavigation";
import { container, arrow, label, today } from "./PeriodNavigator.css";

export interface PeriodNavigatorProps {
  /** Active granularity — determines how far each step moves. */
  view: TimeView;
  /** The reference date whose period is displayed. */
  value: Date;
  /** Called with the new reference date when the user navigates. */
  onChange: (date: Date) => void;
  /**
   * The real "now", used only to decide whether the reference is the current
   * period (so the reset control can hide). Defaults to a fresh `Date`.
   */
  now?: Date;
}

/** Prev / label / next control for browsing between periods (Milestone 4.1). */
export function PeriodNavigator({ view, value, onChange, now = new Date() }: PeriodNavigatorProps) {
  const onCurrent = isSamePeriod(view, value, now);

  return (
    <div className={container} role="group" aria-label="Navigate periods">
      <button
        type="button"
        className={arrow}
        aria-label="Previous period"
        onClick={() => onChange(stepPeriod(view, value, -1))}
      >
        ‹
      </button>
      <span className={label} aria-live="polite">
        {periodLabel(view, value)}
      </span>
      <button
        type="button"
        className={arrow}
        aria-label="Next period"
        onClick={() => onChange(stepPeriod(view, value, 1))}
      >
        ›
      </button>
      {!onCurrent && (
        <button type="button" className={today} onClick={() => onChange(now)}>
          Today
        </button>
      )}
    </div>
  );
}
