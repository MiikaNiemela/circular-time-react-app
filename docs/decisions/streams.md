# Streams

Status: proposed (M13.6). Replaces "one ring per calendar" with **streams**: ordered, named, toggleable rings, each fed by one or more sources. Calendars are the only source kind for now.

## Data model

```prisma
model Stream {
  id        String         @id @default(uuid())
  userId    String
  name      String
  color     String         // a palette key, e.g. "blue", never a raw CSS value
  position  Int            // 0 = outermost ring
  visible   Boolean        @default(true)
  createdAt DateTime       @default(now())
  user      User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  sources   StreamSource[]

  @@index([userId, position])
}

model StreamSource {
  id                   String              @id @default(uuid())
  streamId             String
  kind                 String              // "calendar"; later "tracker", "health", …
  calendarConnectionId String?             @unique
  stream               Stream              @relation(fields: [streamId], references: [id], onDelete: Cascade)
  calendarConnection   CalendarConnection? @relation(fields: [calendarConnectionId], references: [id], onDelete: Cascade)
}
```

- **A source belongs to at most one stream** (`calendarConnectionId @unique`), so an event is never drawn twice.
- **Generic sources:** `kind` names the source type. Each kind has its own nullable reference. A future kind adds a column, for example a tracker id, without changing `Stream`.
- **Colour is a palette key**, resolved through theme tokens in light and dark. It is not a stored hex value, so the theme and contrast rules keep working.
- **Disconnecting a calendar** deletes its source through the cascade. A stream left with no sources is kept, so its name and position survive, but it is not drawn. Settings shows it as "No calendars" with a **Delete** action.

## Defaults and migration

- **The migration creates one stream per existing calendar connection,** using the provider's display name, a palette colour by order, the position by connection age, and visible. The timeline then renders as it does today.
- **Connecting a calendar** creates its stream in the same transaction, unless the user picks an existing stream later.
- **Visibility moves from the browser to the account.** The old browser-only calendar visibility (`localStorage`) is not migrated. It is one preference with a single real user, and the new per-account flag supersedes it. The key is cleared on first load.

## Rendering

- **Pure composition:** `streamRings(streams, calendars, view, now)` replaces `eventRingsForCalendars`. It produces one ring band per visible stream with sources, outermost first. A stream's events take the stream's colour, and provider event colours are ignored.
- **Sub-lanes** (owner decision, option b): `assignLanes(intervals)` is a pure, greedy interval partitioning. Events are sorted by start, then by longer end first, then by key, and each takes the first lane whose last event has ended. The number of lanes equals the maximum number of simultaneous events, and no event is dropped. The band's thickness is split evenly into concentric lanes. Lane 0 carries the free and unknown gaps; the other lanes draw only events. `MultiCircle` is unchanged, because each lane is a `RingConfig`.
- **Day-long events** stay on the shared all-day arch across all visible streams. The agenda dot uses the stream colour.

## Interfaces

- **Loader:** returns `streams: { id, name, color, visible, calendarIds[] }[]` next to the per-calendar events.
- **Mutations:** `POST /streams` (JSON) with one of these intents:
  - `rename`
  - `move` (up or down)
  - `set-visible`
  - `assign` (a calendar to a stream, or to a new stream)
  - `delete` (empty streams only)

  Each intent is authenticated, scoped to the session's account, and validated like the other provider routes. It gets the Origin check from Plans-repo issue #28 when that lands.

- **Settings → Streams:**
  - a text field and Save for the name;
  - **Move up** and **Move down** buttons, keyboard-accessible, with no drag needed;
  - the existing switch for visible;
  - a per-calendar "Stream" select for assignment.
- **Timeline legend:** lists streams with their colour and an on/off toggle that writes `set-visible`.

## Delivery

1. **Schema, migration, repository and loader.** No visible change: the default reproduces today.
2. **`assignLanes`, `streamRings`, stream colours and the legend toggles,** with Storybook stories for 1, 2 and 3 overlapping events.
3. **Settings stream management.**

Each step is its own pull request with tests.
