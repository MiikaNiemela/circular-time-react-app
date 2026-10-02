import { describe, it, expect, vi } from "vitest";
import { runRefreshJob } from "./refreshJob";
import type { RefreshSummary } from "../lib/calendarRefresh";

const START = new Date("2026-10-02T12:00:00.000Z");
const END = new Date("2026-10-02T12:00:01.500Z");

function run(refresh: () => Promise<RefreshSummary>) {
  const log = vi.fn();
  const error = vi.fn();
  const now = vi.fn().mockReturnValueOnce(START).mockReturnValue(END);
  return runRefreshJob({ refresh, log, error, now }).then((code) => ({ code, log, error }));
}

describe("runRefreshJob", () => {
  it("logs an INFO summary and exits 0 when every connection refreshed", async () => {
    const { code, log, error } = await run(async () => ({
      attempted: 2,
      refreshed: 2,
      failures: [],
    }));

    expect(code).toBe(0);
    expect(error).not.toHaveBeenCalled();
    expect(JSON.parse(log.mock.calls[0][0])).toEqual({
      severity: "INFO",
      message: "calendar refresh completed",
      durationMs: 1500,
      attempted: 2,
      refreshed: 2,
      failures: [],
    });
  });

  it("logs a WARNING and exits 0 when some connections failed", async () => {
    const failures = [
      { calendarConnectionId: "c1", provider: "google", reason: "reconnect-required" as const },
    ];
    const { code, log } = await run(async () => ({ attempted: 2, refreshed: 1, failures }));

    expect(code).toBe(0);
    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ severity: "WARNING", failures });
  });

  it("exits 0 when there is nothing to refresh", async () => {
    const { code, log } = await run(async () => ({ attempted: 0, refreshed: 0, failures: [] }));

    expect(code).toBe(0);
    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ severity: "INFO", attempted: 0 });
  });

  it("logs an ERROR and exits 1 when every attempted connection failed", async () => {
    const failures = [
      { calendarConnectionId: "c1", provider: "google", reason: "provider-error" as const },
    ];
    const { code, log, error } = await run(async () => ({ attempted: 1, refreshed: 0, failures }));

    expect(code).toBe(1);
    expect(log).not.toHaveBeenCalled();
    expect(JSON.parse(error.mock.calls[0][0])).toMatchObject({ severity: "ERROR", failures });
  });

  it("logs only the error class and exits 1 when the run throws", async () => {
    const { code, error } = await run(async () => {
      throw new TypeError("connect ECONNREFUSED postgresql://user:secret@db/app");
    });

    expect(code).toBe(1);
    const line = error.mock.calls[0][0] as string;
    expect(JSON.parse(line)).toEqual({
      severity: "ERROR",
      message: "calendar refresh failed",
      durationMs: 1500,
      error: "TypeError",
    });
    expect(line).not.toContain("secret");
  });
});
