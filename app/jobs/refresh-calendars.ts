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

// Writes to a pipe are asynchronous, so exiting immediately can cut off the
// summary line. A write callback runs after every earlier write on that stream
// has been handled. Exit explicitly afterwards, because open client handles
// such as gRPC channels could otherwise keep the process alive.
const flush = (stream: NodeJS.WriteStream) =>
  new Promise<void>((resolve) => stream.write("", () => resolve()));
await Promise.all([flush(process.stdout), flush(process.stderr)]);
process.exit(code);
