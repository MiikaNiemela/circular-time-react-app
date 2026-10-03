import { describe, it, expect, vi, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { useNow } from "./useNow";

afterEach(() => {
  vi.useRealTimers();
});

describe("useNow", () => {
  it("renders nothing on the server", () => {
    function Probe() {
      return <span>{useNow()?.toISOString() ?? "none"}</span>;
    }
    expect(renderToString(<Probe />)).toContain("none");
  });

  it("starts with the current time and advances at least once a minute", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-23T11:20:00Z"));
    const { result, unmount } = renderHook(() => useNow());

    expect(result.current?.toISOString()).toBe("2026-06-23T11:20:00.000Z");
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current?.toISOString()).toBe("2026-06-23T11:21:00.000Z");

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
