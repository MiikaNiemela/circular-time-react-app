# Streams

Status: accepted; step 1 (model, defaults, `POST /streams`) implemented (M13.6). Replaces "one ring per calendar" with **streams**: ordered, named, toggleable rings, each fed by one or more sources. Calendars are the only source kind for now.

## Data model

```prisma
model Stream {
  id        String         @id @default(uuid())
  userId    String
  name      String
  color     String         // a palette key, e.g. "blue", never a raw CSS value
  position  Int            // 0 = outermost ring; dense 0..n-1 per account
  visible   Boolean        @default(true)
  createdAt DateTime       @default(now())
  user      User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  sources   StreamSource[]

  @@unique([id, userId])
  @@index([userId, position])
}

model StreamSource {
  id                   String              @id @default(uuid())
  userId               String
  streamId             String
  kind                 String              // "calendar"; later "tracker", "health", …
  calendarConnectionId String?             @unique
  stream               Stream              @relation(fields: [streamId, userId], references: [id, userId], onDelete: Cascade)
  calendarConnection   CalendarConnection? @relation(fields: [calendarConnectionId, userId], references: [id, userId], onDelete: Cascade)
}
```

- **Inverse relations.** `User` gets `streams Stream[]` and `CalendarConnection` gets `streamSources StreamSource[]`. Step 1 runs `prisma validate` on the complete schema; with these fields Prisma generates both composite foreign keys with `ON DELETE CASCADE`, including the nullable calendar reference.
- **Account scoping is enforced by the database.** A source carries `userId`, and both foreign keys are composite with it: `(streamId, userId)` → `Stream(id, userId)`, and `(calendarConnectionId, userId)` → `CalendarConnection(id, userId)`, which already has `@@unique([id, userId])`. A source therefore can't join one account's stream to another account's calendar.
- **The kind and its reference must match.** The migration adds a check constraint in raw SQL: `CHECK ((kind = 'calendar') = ("calendarConnectionId" IS NOT NULL))`, and `kind IN ('calendar')` until another kind exists. A future kind extends the check together with its own column, so a `calendar` source without a calendar, or a calendar reference on another kind, can't be stored.
- **A source belongs to at most one stream** (`calendarConnectionId @unique`), so an event is never drawn twice.
- **Colour is a palette key**, resolved through theme tokens in light and dark. It is not a stored hex value, so the theme and contrast rules keep working. The palette's ring colours get contrast tests against the ring track and the background in both themes.
- **Disconnecting a calendar** deletes its source through the cascade. A stream left with no sources is kept, so its name and position survive, but it is not drawn. Settings shows it as "No calendars" with a **Delete** action.

## Defaults

- **No SQL backfill.** The migration only creates the tables and constraints. `ensureDefaultStreams(userId)` runs on timeline load and gives every calendar connection without a source a new stream, so connecting a calendar needs no special path.
  - **No writes when nothing is missing:** it first reads connections and sources. When every connection has a source, which is every load after the first, it returns without a transaction or write and never rewrites positions.
  - **Losing a race is not an error:** otherwise it runs in `runSerializable`, which appends positions after the current maximum. If two first loads race, one insert fails on `calendarConnectionId @unique` (Prisma `P2002`) or a serialization conflict (`P2034`). The losing call then re-reads instead of failing, retrying up to eight times with a short jittered back-off, and returns the winner's streams.
  - **Tests:** several connections, idempotence (a second call does no writes), a mocked `P2002` on insert that resolves to the re-read streams, and a concurrency test running two `ensureDefaultStreams` calls in parallel against the PostgreSQL used by the migration test, ending with exactly one stream per connection.
- **Default stream:**
  - name: the static provider label (`google` → "Google Calendar", `outlook` → "Outlook", as `calendarLabel`);
  - position: appended in `createdAt, id` order;
  - colour: the next palette key in order;
  - visible: on.
- **Stable order:** `getCalendarConnections` is also ordered by `createdAt, id`. Today's ring order is otherwise unspecified, so the default reproduces today's rings in that order.
- **Intentional visual change:** a stream's events take the stream's colour. Providers don't set event colours today, so in production every slice is the amber fallback. With streams, each stream gets its own colour. Apart from colour, rings, order and slices render as today; a regression test asserts provider event colours are ignored.
- **Visibility moves from the browser to the account.** The browser-only calendar visibility (`localStorage`) is not migrated. It is one preference with a single real user, and the per-account flag replaces it. The key is cleared on first load.

## Rendering

- **Pure composition:** `streamRings(streams, calendars, view, now)` replaces `eventRingsForCalendars`. It produces one ring band per visible stream with sources, outermost first.
- **Coverage:** a stream counts as fetched for the shown window only if **every** source covers it, using its fetched or cached ranges as `blankState` does. Otherwise gaps are `unknown` rather than `free`, because a missing source may hold events. A source that failed contributes only its cached ranges. Tests cover mixed coverage.
- **Sub-lanes** (owner decision, option b):
  - **Which events:** in the day view, day-long events (`isDayLong`) are removed first, since they're on the arch, so they don't add lanes.
  - **Assignment:** `assignLanes(intervals)` is a pure, greedy interval partitioning. Events are sorted by start, then by longer end first, then by key, and each takes the first lane whose last event has ended. The number of lanes equals the maximum number of simultaneous events, and no event is dropped.
  - **Drawing:** the band's thickness is split evenly into concentric lanes. Lane 0 carries the free and unknown gaps; the other lanes draw only events. `MultiCircle` is unchanged, because each lane is a `RingConfig`.
- **The agenda dot** uses the stream colour.

## Interfaces

- **Loader:** returns `streams: { id, name, color, visible, calendarIds[] }[]` next to the per-calendar events.
- **Mutations:** `POST /streams` (JSON) with one of these intents:
  - `rename`
  - `move` (up or down)
  - `set-visible`
  - `assign` (a calendar to a stream, or to a new stream)
  - `delete` (empty streams only)

  Every intent requires the session and the same-origin gate (below). Each is scoped to the session's account: every stream and calendar id is looked up with `userId`, and an unknown id returns 404. Bodies are validated like the other provider routes.

- **Ordering is atomic.** Every intent that changes positions (`move`, `assign` to a new stream, `delete`) runs in the repository's serializable transaction with conflict retries (`runSerializable`). It reads the account's streams ordered by `position, id`, applies the change, and writes positions back densely as 0..n−1. A new stream is appended at n. Two concurrent moves therefore serialize instead of overwriting each other. A test covers concurrent moves against a mocked conflict and retry.
- **Settings → Streams:**
  - a text field and Save for the name;
  - **Move up** and **Move down** buttons, keyboard-accessible, with no drag needed;
  - the existing switch for visible;
  - a per-calendar "Stream" select for assignment.
- **Timeline legend:** lists streams with their colour and an on/off toggle that posts `set-visible`.

## Same-origin gate

The shared check from Plans-repo issue #28 is a **prerequisite**, not a follow-up:

- a session-authenticated POST is accepted only when `Origin` (or, without it, `Referer`) is the app's origin;
- JSON routes require `Content-Type: application/json`.

It ships first, applied to the existing mutation routes, and `/streams` uses it from its first commit. Route tests cover a wrong origin, a missing origin header and a wrong content type.

## Delivery

Each step is its own pull request, releasable on its own, with tests:

0. **Same-origin and content-type gate** (#28) for the existing mutation routes.
1. **Schema, constraints, `ensureDefaultStreams`, ordered connections, the loader's `streams`, and `POST /streams`** with every intent: validation, account scoping, the gate and atomic ordering. Nothing visible changes yet.
2. **`assignLanes`, coverage composition, `streamRings`, stream colours and the legend toggles,** with Storybook stories for 1, 2 and 3 overlapping events and a mixed-coverage case.
3. **Settings stream management.**
