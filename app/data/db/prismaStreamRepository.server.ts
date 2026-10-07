import { Prisma, type PrismaClient } from "@prisma/client";
import {
  STREAM_COLORS,
  defaultStreamName,
  isStreamColor,
  moveItem,
  type Stream,
  type StreamChange,
  type StreamChangeResult,
} from "../streams";

/** Attempts at a serializable change before a lost race is reported. */
const MAX_ATTEMPTS = 8;

/** Waits a little longer after each lost race, with jitter, so retries spread out. */
const backoff = (attempt: number) =>
  new Promise((resolve) => setTimeout(resolve, Math.random() * 10 * 2 ** attempt));

/** A serialization conflict (P2034) or a lost unique-constraint race (P2002). */
function isRaceError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "P2034" || error.code === "P2002")
  );
}

type Tx = Prisma.TransactionClient;

const STREAM_SELECT = {
  id: true,
  name: true,
  color: true,
  visible: true,
  sources: {
    select: { calendarConnectionId: true, calendarConnection: { select: { createdAt: true } } },
  },
} as const;

/** Prisma-backed stream persistence; see docs/decisions/streams.md. */
export class PrismaStreamRepository {
  constructor(private readonly db: PrismaClient) {}

  /** Runs `operation` serializably, retrying a lost race by running it again. */
  private async serializable<T>(operation: (tx: Tx) => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.db.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error: unknown) {
        if (!isRaceError(error) || attempt >= MAX_ATTEMPTS) throw error;
        await backoff(attempt);
      }
    }
  }

  private async readStreams(db: Tx | PrismaClient, userId: string): Promise<Stream[]> {
    const rows = await db.stream.findMany({
      where: { userId },
      orderBy: [{ position: "asc" }, { id: "asc" }],
      select: STREAM_SELECT,
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      color: isStreamColor(row.color) ? row.color : STREAM_COLORS[0],
      visible: row.visible,
      calendarConnectionIds: row.sources
        .flatMap((s) =>
          s.calendarConnectionId && s.calendarConnection
            ? [{ id: s.calendarConnectionId, at: s.calendarConnection.createdAt.getTime() }]
            : []
        )
        .sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1))
        .map((s) => s.id),
    }));
  }

  private async unassignedConnections(db: Tx | PrismaClient, userId: string) {
    return db.calendarConnection.findMany({
      where: { userId, streamSources: { none: {} } },
      select: { id: true, provider: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }

  async ensureDefaultStreams(userId: string): Promise<Stream[]> {
    // The common case writes nothing: every connection already has a stream.
    if ((await this.unassignedConnections(this.db, userId)).length === 0) {
      return this.readStreams(this.db, userId);
    }
    return this.serializable(async (tx) => {
      const missing = await this.unassignedConnections(tx, userId);
      const count = await tx.stream.count({ where: { userId } });
      for (const [i, connection] of missing.entries()) {
        await tx.stream.create({
          data: {
            userId,
            name: defaultStreamName(connection.provider),
            color: STREAM_COLORS[(count + i) % STREAM_COLORS.length],
            position: count + i,
            // A nested source takes userId from its stream.
            sources: { create: { kind: "calendar", calendarConnectionId: connection.id } },
          },
        });
      }
      return this.readStreams(tx, userId);
    });
  }

  /** Rewrites the account's stream positions densely as 0..n-1 in `order`. */
  private async writeOrder(tx: Tx, order: { id: string }[]) {
    for (const [position, stream] of order.entries()) {
      await tx.stream.update({ where: { id: stream.id }, data: { position } });
    }
  }

  async applyStreamChange(userId: string, change: StreamChange): Promise<StreamChangeResult> {
    return this.serializable(async (tx) => {
      const streams = await tx.stream.findMany({
        where: { userId },
        orderBy: [{ position: "asc" }, { id: "asc" }],
        select: { id: true, _count: { select: { sources: true } } },
      });
      const index =
        "streamId" in change && change.streamId !== null
          ? streams.findIndex((s) => s.id === change.streamId)
          : -1;
      const needsStream = change.intent !== "assign" || change.streamId !== null;
      if (needsStream && index === -1) return "not-found";

      switch (change.intent) {
        case "rename":
          await tx.stream.update({ where: { id: change.streamId }, data: { name: change.name } });
          return "ok";
        case "set-visible":
          await tx.stream.update({
            where: { id: change.streamId },
            data: { visible: change.visible },
          });
          return "ok";
        case "move":
          await this.writeOrder(tx, moveItem(streams, index, change.direction));
          return "ok";
        case "delete":
          if (streams[index]._count.sources > 0) return "not-empty";
          await tx.stream.delete({ where: { id: change.streamId } });
          await this.writeOrder(
            tx,
            streams.filter((s) => s.id !== change.streamId)
          );
          return "ok";
        case "assign": {
          const connection = await tx.calendarConnection.findUnique({
            where: { id_userId: { id: change.calendarConnectionId, userId } },
            select: { id: true, provider: true },
          });
          if (!connection) return "not-found";
          let streamId = change.streamId;
          if (streamId === null) {
            const created = await tx.stream.create({
              data: {
                userId,
                name: defaultStreamName(connection.provider),
                color: STREAM_COLORS[streams.length % STREAM_COLORS.length],
                position: streams.length,
              },
              select: { id: true },
            });
            streamId = created.id;
          }
          await tx.streamSource.deleteMany({
            where: { userId, calendarConnectionId: connection.id },
          });
          await tx.streamSource.create({
            data: { userId, streamId, kind: "calendar", calendarConnectionId: connection.id },
          });
          return "ok";
        }
      }
    });
  }
}
