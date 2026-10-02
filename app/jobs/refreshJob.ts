/**
 * Runs one background calendar refresh and reports it as a single structured
 * log line. Kept free of process and database wiring so it can be tested.
 */
import type { RefreshSummary } from "../lib/calendarRefresh";

/** Collaborators for {@link runRefreshJob}. */
export interface RefreshJobDeps {
  refresh: () => Promise<RefreshSummary>;
  log: (line: string) => void;
  error: (line: string) => void;
  now: () => Date;
}

/**
 * Runs the refresh and returns the process exit code: 0 when the run
 * completed, 1 when it threw or when every attempted connection failed.
 * The log lines carry the summary only: connection IDs, providers, and
 * failure reasons, never user identifiers, tokens, or provider error text.
 */
export async function runRefreshJob(deps: RefreshJobDeps): Promise<number> {
  const startedAt = deps.now();
  try {
    const summary = await deps.refresh();
    const allFailed = summary.attempted > 0 && summary.refreshed === 0;
    const line = {
      severity: allFailed ? "ERROR" : summary.failures.length > 0 ? "WARNING" : "INFO",
      message: "calendar refresh completed",
      durationMs: deps.now().getTime() - startedAt.getTime(),
      ...summary,
    };
    (allFailed ? deps.error : deps.log)(JSON.stringify(line));
    return allFailed ? 1 : 0;
  } catch (error: unknown) {
    deps.error(
      JSON.stringify({
        severity: "ERROR",
        message: "calendar refresh failed",
        durationMs: deps.now().getTime() - startedAt.getTime(),
        error: error instanceof Error ? error.name : "UnknownError",
      })
    );
    return 1;
  }
}
