import { describe, it, expect } from "vitest";
import { stepPeriod, isSamePeriod, periodLabel } from "./timeNavigation";

describe("stepPeriod", () => {
  it("moves a day forward and back", () => {
    const d = new Date(2026, 5, 19); // Fri 19 Jun 2026
    expect(stepPeriod("day", d, 1).getDate()).toBe(20);
    expect(stepPeriod("day", d, -1).getDate()).toBe(18);
  });

  it("moves a week by seven days", () => {
    const d = new Date(2026, 5, 19);
    expect(stepPeriod("week", d, 1).getDate()).toBe(26);
    expect(stepPeriod("week", d, -1).getDate()).toBe(12);
  });

  it("moves a month and clamps the day to the target month length", () => {
    const d = new Date(2026, 0, 31); // 31 Jan 2026
    const next = stepPeriod("month", d, 1); // Feb has 28 days in 2026
    expect(next.getMonth()).toBe(1);
    expect(next.getDate()).toBe(28);
  });

  it("moves a year and clamps a leap day", () => {
    const d = new Date(2028, 1, 29); // 29 Feb 2028 (leap)
    const next = stepPeriod("year", d, 1); // 2029 is not a leap year
    expect(next.getFullYear()).toBe(2029);
    expect(next.getMonth()).toBe(1);
    expect(next.getDate()).toBe(28);
  });

  it("crosses a year boundary stepping December forward", () => {
    const d = new Date(2026, 11, 15);
    const next = stepPeriod("month", d, 1);
    expect(next.getFullYear()).toBe(2027);
    expect(next.getMonth()).toBe(0);
  });
});

describe("isSamePeriod", () => {
  it("treats different days in the same week as the same week", () => {
    const mon = new Date(2026, 5, 15);
    const sun = new Date(2026, 5, 21);
    expect(isSamePeriod("week", mon, sun)).toBe(true);
    expect(isSamePeriod("day", mon, sun)).toBe(false);
  });

  it("distinguishes months and years", () => {
    expect(isSamePeriod("month", new Date(2026, 5, 1), new Date(2026, 6, 1))).toBe(false);
    expect(isSamePeriod("year", new Date(2026, 11, 31), new Date(2026, 0, 1))).toBe(true);
  });
});

describe("periodLabel", () => {
  it("labels each granularity", () => {
    const d = new Date(2026, 5, 19);
    expect(periodLabel("month", d)).toContain("2026");
    expect(periodLabel("year", d)).toBe("2026");
    // Week label spans a range.
    expect(periodLabel("week", d)).toContain("–");
  });
});
