/**
 * Calendar dates as `YYYY-MM-DD` strings in the runtime's time zone. The
 * timeline's `ref` URL parameter is a local calendar day, not an instant:
 * `new Date("2026-06-23")` would read it as UTC midnight, which is the
 * previous local day west of UTC.
 */

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Local midnight of a `YYYY-MM-DD` date, or null when it is not a real date. */
export function parseLocalDate(key: string): Date | null {
  const match = DATE_KEY.exec(key);
  if (!match) return null;
  const [y, m, d] = match.slice(1).map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
    ? date
    : null;
}

/** The local calendar date of `date` as `YYYY-MM-DD`. */
export function formatLocalDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
