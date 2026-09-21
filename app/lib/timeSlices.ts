/**
 * Background time-grid rings: converts the current view and reference date
 * into `RingConfig[]` that show time units as coloured arcs with arched labels.
 *
 * Each view (day/week/month/year) re-slices at a different temporal granularity
 * — this is the correctness fix over the original React Native app, which
 * rendered the same slices regardless of which view was selected.
 *
 * By default all slices share a neutral colour. Pass `temporalColors: true` to
 * colour past/current/future units distinctly. Ring dimensions are configurable
 * via the options object; hardcoded sizes are a dev-mode default only.
 */

import type { RingConfig } from "../components/timeline";
import type { TimeView } from "../components/SegmentedControl";
import { palette } from "../styles/primitives";

const COLOR_PAST = palette.blue600;
const COLOR_CURRENT = palette.blue400;
/** Shared by neutral default mode and temporal future units. */
const COLOR_FUTURE = palette.gray200;

const WEEK_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Total days in a month (1-based month). */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Options that control how `slicesForView` produces its rings.
 */
export interface SlicesForViewOptions {
  /**
   * When true, past units are coloured accent-blue, the current unit is
   * light-blue, and future units are muted grey.
   * When false (default) all units share the same neutral grey.
   */
  temporalColors?: boolean;
  /** Stroke width of the outer ring in SVG user units. Default: 24. */
  outerLineWidth?: number;
  /** Stroke width of the inner ring in SVG user units. Default: 16. */
  innerLineWidth?: number;
  /** Outer diameter of the outer ring in SVG user units. Default: 280. */
  outerSize?: number;
  /** Outer diameter of the inner ring in SVG user units. Default: 200. */
  innerSize?: number;
}

interface ResolvedOptions {
  temporalColors: boolean;
  outerLineWidth: number;
  innerLineWidth: number;
  outerSize: number;
  innerSize: number;
}

function resolveOptions(options?: SlicesForViewOptions): ResolvedOptions {
  return {
    temporalColors: options?.temporalColors ?? false,
    outerLineWidth: options?.outerLineWidth ?? 24,
    innerLineWidth: options?.innerLineWidth ?? 16,
    outerSize: options?.outerSize ?? 280,
    innerSize: options?.innerSize ?? 200,
  };
}

function resolveOuterRingOptions(options?: SlicesForViewOptions): ResolvedOptions {
  return {
    temporalColors: options?.temporalColors ?? false,
    outerLineWidth: options?.outerLineWidth ?? 15,
    innerLineWidth: options?.innerLineWidth ?? 0,
    outerSize: options?.outerSize ?? 280,
    innerSize: options?.innerSize ?? 200,
  };
}

function gridColor(opts: ResolvedOptions, position: "past" | "current" | "future"): string {
  if (!opts.temporalColors) return COLOR_FUTURE;
  if (position === "past") return COLOR_PAST;
  if (position === "current") return COLOR_CURRENT;
  return COLOR_FUTURE;
}

/**
 * Produces `RingConfig[]` for the given view and reference date.
 *
 * Each view re-slices the same temporal data at a different granularity —
 * this is the correctness guarantee missing from the original RN app.
 * Ring sizes and temporal colouring are controlled via `options`.
 */
export function slicesForView(
  view: TimeView,
  now: Date,
  options?: SlicesForViewOptions
): RingConfig[] {
  const opts = resolveOptions(options);
  switch (view) {
    case "day":
      return dayRings(now, opts);
    case "week":
      return weekRings(now, opts);
    case "month":
      return monthRings(now, opts);
    case "year":
      return yearRings(now, opts);
  }
}
/**
 * Variant of `slicesForView` that applies outer-ring size defaults — a wider
 * stroke and no inner ring — instead of the balanced dual-ring defaults.
 */
export function slicesForViewOuterRing(
  view: TimeView,
  now: Date,
  options?: SlicesForViewOptions
): RingConfig[] {
  const opts = resolveOuterRingOptions(options);
  return slicesForView(view, now, opts);
}
// ---------------------------------------------------------------------------
// Day: outer = hours (24), inner = minutes within current hour
// ---------------------------------------------------------------------------
function dayRings(now: Date, opts: ResolvedOptions): RingConfig[] {
  const hour = now.getHours();
  const minute = now.getMinutes();
  const degreesPerHour = 360 / 24;

  const hourSlices = Array.from({ length: 24 }, (_, i) => ({
    color: gridColor(opts, i < hour ? "past" : i === hour ? "current" : "future"),
    degrees: degreesPerHour,
    label: String(i),
    visible: true as const,
  }));

  const minuteSlices = [
    { color: gridColor(opts, "past"), degrees: (minute / 60) * 360, visible: true as const },
    {
      color: gridColor(opts, "future"),
      degrees: ((60 - minute) / 60) * 360,
      visible: true as const,
    },
  ];

  return [
    { slices: hourSlices, lineWidth: opts.outerLineWidth, size: opts.outerSize },
    { slices: minuteSlices, lineWidth: opts.innerLineWidth, size: opts.innerSize },
  ];
}

// ---------------------------------------------------------------------------
// Week: outer = 7 days, inner = hours elapsed today
// ---------------------------------------------------------------------------
function weekRings(now: Date, opts: ResolvedOptions): RingConfig[] {
  // Sunday = 0 in JS; rotate so Monday = first
  const jsDay = now.getDay();
  const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1; // Mon=0 … Sun=6
  const degreesPerDay = 360 / 7;

  const daySlices = Array.from({ length: 7 }, (_, i) => ({
    color: gridColor(opts, i < dayOfWeek ? "past" : i === dayOfWeek ? "current" : "future"),
    degrees: degreesPerDay,
    label: WEEK_LABELS[i],
    visible: true as const,
  }));

  const hourFraction = (now.getHours() * 60 + now.getMinutes()) / (24 * 60);
  const hourSlices = [
    { color: gridColor(opts, "past"), degrees: hourFraction * 360, visible: true as const },
    { color: gridColor(opts, "future"), degrees: (1 - hourFraction) * 360, visible: true as const },
  ];

  return [
    { slices: daySlices, lineWidth: opts.outerLineWidth, size: opts.outerSize },
    { slices: hourSlices, lineWidth: opts.innerLineWidth, size: opts.innerSize },
  ];
}

// ---------------------------------------------------------------------------
// Month: outer = days of month, inner = hour of day
// ---------------------------------------------------------------------------
function monthRings(now: Date, opts: ResolvedOptions): RingConfig[] {
  const day = now.getDate();
  const total = daysInMonth(now.getFullYear(), now.getMonth() + 1);
  const degreesPerDay = 360 / total;

  const daySlices = Array.from({ length: total }, (_, i) => ({
    color: gridColor(opts, i + 1 < day ? "past" : i + 1 === day ? "current" : "future"),
    degrees: degreesPerDay,
    label: String(i + 1),
    visible: true as const,
  }));

  const hourFraction = now.getHours() / 24;
  const hourSlices = [
    { color: gridColor(opts, "past"), degrees: hourFraction * 360, visible: true as const },
    { color: gridColor(opts, "future"), degrees: (1 - hourFraction) * 360, visible: true as const },
  ];

  return [
    { slices: daySlices, lineWidth: opts.outerLineWidth, size: opts.outerSize },
    { slices: hourSlices, lineWidth: opts.innerLineWidth, size: opts.innerSize },
  ];
}

// ---------------------------------------------------------------------------
// Year: outer = 12 months (proportional to days), inner = day of month
// ---------------------------------------------------------------------------
function yearRings(now: Date, opts: ResolvedOptions): RingConfig[] {
  const currentMonth = now.getMonth(); // 0-based
  const year = now.getFullYear();
  const totalDays = Array.from({ length: 12 }, (_, m) => daysInMonth(year, m + 1)).reduce(
    (a, b) => a + b,
    0
  );

  const monthSlices = Array.from({ length: 12 }, (_, m) => ({
    color: gridColor(opts, m < currentMonth ? "past" : m === currentMonth ? "current" : "future"),
    degrees: (daysInMonth(year, m + 1) / totalDays) * 360,
    label: MONTH_LABELS[m],
    visible: true as const,
  }));

  const day = now.getDate();
  const daysThisMonth = daysInMonth(year, currentMonth + 1);
  const dayFraction = day / daysThisMonth;
  const daySlices = [
    { color: gridColor(opts, "past"), degrees: dayFraction * 360, visible: true as const },
    { color: gridColor(opts, "future"), degrees: (1 - dayFraction) * 360, visible: true as const },
  ];

  return [
    { slices: monthSlices, lineWidth: opts.outerLineWidth, size: opts.outerSize },
    { slices: daySlices, lineWidth: opts.innerLineWidth, size: opts.innerSize },
  ];
}
