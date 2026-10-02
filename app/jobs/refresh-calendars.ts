/**
 * Command-line entry for one background calendar refresh run.
 *
 * Refreshes the near-future months of every calendar connection with stored
 * credentials, prints one JSON summary line, and exits. Any scheduler can run
 * it: cron, a container orchestrator, or a managed job service.
 *
 * Exit codes:
 * - 0: the run completed; individual connections may still have failed and
 *   are listed in the summary.
 * - 1: the run itself failed (for example, the database is unreachable), or
 *   no connection refreshed and at least one failed for a reason other than
 *   needing the user to reconnect.
 */
import { prisma } from "../data/db/prismaClient.server";
import { refreshAllCalendars } from "../lib/calendarReader.server";
import { runRefreshJob } from "./refreshJob";

const code = await runRefreshJob({
  refresh: refreshAllCalendars,
  log: (line) => console.log(line),
  error: (line) => console.error(line),
  now: () => new Date(),
});
await prisma.$disconnect();
process.exit(code);
