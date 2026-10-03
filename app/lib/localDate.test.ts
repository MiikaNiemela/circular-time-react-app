import { describe, it, expect, afterEach } from "vitest";
import { formatLocalDate, parseLocalDate } from "./localDate";

const originalTz = process.env.TZ;
afterEach(() => {
  process.env.TZ = originalTz;
});

describe.each(["America/Los_Angeles", "UTC", "Pacific/Auckland"])("in %s", (tz) => {
  it("reads a date key as local midnight of that day", () => {
    process.env.TZ = tz;
    const date = parseLocalDate("2026-06-23")!;
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([
      2026, 5, 23, 0,
    ]);
  });

  it("round-trips through formatLocalDate", () => {
    process.env.TZ = tz;
    expect(formatLocalDate(parseLocalDate("2026-03-29")!)).toBe("2026-03-29");
  });

  it("formats the local day, not the UTC day", () => {
    process.env.TZ = tz;
    expect(formatLocalDate(new Date(2026, 5, 23, 23, 30))).toBe("2026-06-23");
    expect(formatLocalDate(new Date(2026, 5, 23, 0, 30))).toBe("2026-06-23");
  });
});

describe("parseLocalDate", () => {
  it.each(["", "2026-6-23", "23.06.2026", "2026-02-30", "2026-13-01"])("rejects %j", (key) => {
    expect(parseLocalDate(key)).toBeNull();
  });
});
