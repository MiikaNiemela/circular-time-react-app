/**
 * Streams: ordered, named, toggleable rings fed by sources (calendars for
 * now). See docs/decisions/streams.md.
 */

/** Palette keys a stream can take, in the order new streams get them. */
export const STREAM_COLORS = ["blue", "teal", "violet", "amber", "rose", "green"] as const;
export type StreamColor = (typeof STREAM_COLORS)[number];

export function isStreamColor(value: unknown): value is StreamColor {
  return typeof value === "string" && (STREAM_COLORS as readonly string[]).includes(value);
}

/** A stream as the timeline and Settings see it. */
export interface Stream {
  id: string;
  name: string;
  color: StreamColor;
  visible: boolean;
  /** Calendar connection ids feeding the stream, in connection order. */
  calendarConnectionIds: string[];
}

/** Longest stream name, in characters. */
export const MAX_STREAM_NAME = 60;

/** Default stream name for a provider's calendar. */
export function defaultStreamName(provider: string): string {
  switch (provider) {
    case "google":
      return "Google Calendar";
    case "outlook":
      return "Outlook";
    default:
      return provider;
  }
}

/** One change to an account's streams. */
export type StreamChange =
  | { intent: "rename"; streamId: string; name: string }
  | { intent: "move"; streamId: string; direction: "up" | "down" }
  | { intent: "set-visible"; streamId: string; visible: boolean }
  | { intent: "assign"; calendarConnectionId: string; streamId: string | null }
  | { intent: "delete"; streamId: string };

/**
 * `ok`: applied. `not-found`: a stream or calendar id does not belong to the
 * account. `not-empty`: a stream with sources cannot be deleted.
 */
export type StreamChangeResult = "ok" | "not-found" | "not-empty";

/** Persistence for streams; every method is scoped to one account. */
export interface StreamRepository {
  /**
   * The account's streams, outermost first, after giving every calendar
   * connection without a stream its own default stream. Read-only when
   * nothing is missing.
   */
  ensureDefaultStreams(userId: string): Promise<Stream[]>;
  /** Applies one change atomically. */
  applyStreamChange(userId: string, change: StreamChange): Promise<StreamChangeResult>;
}

/**
 * Moves the item at `index` one place up (towards 0) or down, returning a new
 * array; at either end it is returned unchanged.
 */
export function moveItem<T>(items: readonly T[], index: number, direction: "up" | "down"): T[] {
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return [...items];
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Reads and validates a `POST /streams` body, or null when it is malformed. */
export function parseStreamChange(body: unknown): StreamChange | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  const id = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 64;
  switch (b.intent) {
    case "rename": {
      const name = typeof b.name === "string" ? b.name.trim() : "";
      return id(b.streamId) && name.length > 0 && name.length <= MAX_STREAM_NAME
        ? { intent: "rename", streamId: b.streamId, name }
        : null;
    }
    case "move":
      return id(b.streamId) && (b.direction === "up" || b.direction === "down")
        ? { intent: "move", streamId: b.streamId, direction: b.direction }
        : null;
    case "set-visible":
      return id(b.streamId) && typeof b.visible === "boolean"
        ? { intent: "set-visible", streamId: b.streamId, visible: b.visible }
        : null;
    case "assign":
      return id(b.calendarConnectionId) && (b.streamId === null || id(b.streamId))
        ? { intent: "assign", calendarConnectionId: b.calendarConnectionId, streamId: b.streamId }
        : null;
    case "delete":
      return id(b.streamId) ? { intent: "delete", streamId: b.streamId } : null;
    default:
      return null;
  }
}
