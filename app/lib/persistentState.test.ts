import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useReferenceDate, useShowTimeLapse } from "./persistentState";

const REFERENCE_KEY = "circular-time-reference-date";
const TIME_LAPSE_KEY = "circular-time-show-time-lapse";

describe("useReferenceDate", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to today when nothing is stored", () => {
    const { result } = renderHook(() => useReferenceDate());
    const [reference] = result.current;
    expect(reference).toBeInstanceOf(Date);
    expect(reference?.toDateString()).toBe(new Date().toDateString());
  });

  it("reads a previously persisted date", () => {
    const stored = new Date("2026-03-14T12:00:00.000Z");
    localStorage.setItem(REFERENCE_KEY, stored.toISOString());
    const { result } = renderHook(() => useReferenceDate());
    expect(result.current[0]?.toISOString()).toBe(stored.toISOString());
  });

  it("persists the date on change and re-renders with it", () => {
    const { result } = renderHook(() => useReferenceDate());
    const next = new Date("2025-12-25T00:00:00.000Z");
    act(() => result.current[1](next));
    expect(result.current[0]?.toISOString()).toBe(next.toISOString());
    expect(localStorage.getItem(REFERENCE_KEY)).toBe(next.toISOString());
  });
});

describe("useShowTimeLapse", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to false when nothing is stored", () => {
    const { result } = renderHook(() => useShowTimeLapse());
    expect(result.current[0]).toBe(false);
  });

  it("reads a persisted preference", () => {
    localStorage.setItem(TIME_LAPSE_KEY, "true");
    const { result } = renderHook(() => useShowTimeLapse());
    expect(result.current[0]).toBe(true);
  });

  it("persists the preference on change", () => {
    const { result } = renderHook(() => useShowTimeLapse());
    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);
    expect(localStorage.getItem(TIME_LAPSE_KEY)).toBe("true");
  });
});
