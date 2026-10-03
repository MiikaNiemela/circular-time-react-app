# Features

This document tracks what Circular Time can do and what is planned. It is the single source of truth for feature status; update it whenever a feature changes state.

Status is taken from the original React Native app (the functional baseline) and re-scoped for the web rewrite. A feature is **carried over** when the React Native version already implemented it and the web version must match; **planned** when it was specified but never built; and **new** when it exists only because this is a web app.

Legend: ✅ done · 🟡 in progress · ⬜ not started · ⏸ deferred

---

## Core visualisation

| Feature | Status | Origin | Notes |
|---|---|---|---|
| Circular timeline rendering (SVG arcs) | ✅ | carried over | `Circle` / `MultiCircle` in `app/components/timeline/`. |
| Multiple rings on one circle (multi-schedule) | ✅ | planned | One ring per calendar, plus background grid rings, composed via `eventRingsForCalendars`. |
| Day / Week / Month / Year view selector | ✅ | carried over | `SegmentedControl`; switching re-slices the full background grid and the event windows. |
| Chronological slice ordering from the top | ✅ | planned | `slicesForView` + `eventSlicesForView` place slices from 12 o'clock. |
| Interactive slices (tap/click a slice) | ✅ | planned | `onSliceClick` per slice wired through `Circle` and `MultiCircle`; decision documented in Milestone 1.4. |
| "Unknown" state for unfetched periods | ✅ | planned | `EVENT_COLORS.unknown` fills any range not covered by `fetchedRange`. |
| Current time on the day circle | ✅ | **new** | Today's day view shows a current-time hand and a centre clock (24-hour time and date); other days show the date. The hand uses the event slices' mapping, so it lines up with events on DST days. `hand` and `centerLabel` on `MultiCircle`. |
| Time navigation (browse to a specific day/week/month/year) | ✅ | planned | `PeriodNavigator` component with prev/label/next and a Today reset (Milestone 4.1). |

---

## Calendar data

| Feature | Status | Origin | Notes |
|---|---|---|---|
| Google Calendar integration | ✅ | planned | Server-side OAuth 2.0 authorization-code flow with PKCE and a confidential client secret (GCP Secret Manager); `GoogleCalendarProvider`. |
| Outlook Calendar integration | ✅ | planned | Microsoft Graph; server-side OAuth 2.0 authorization-code flow with PKCE as a confidential web client (secret in GCP Secret Manager); `OutlookCalendarProvider`. |
| Local calendar access | ⏸ | planned (re-scoped) | `.ics`/CalDAV import. Deferred — no test service available (Milestone 3.5). |
| Per-calendar visibility filtering | ✅ | planned | `CalendarVisibilityStore` persists show/hide; settings toggles write through; timeline respects. |
| Refresh policy | ✅ | planned | Past = manual refresh only; near-future (≤1 day) = auto on open once the cached copy is 15 minutes old. Runs server-side on whole UTC months, which every view shares, and fetches only months that are missing or stale. |
| Secure credential storage | ✅ | planned | Provider OAuth tokens held only on the server, encrypted with AES-256-GCM under an application key and bound to their user and calendar connection; user identity in a signed HTTP-only session cookie; OAuth client secrets in GCP Secret Manager, never in the image. |

---

## Identity & persistence

| Feature | Status | Origin | Notes |
|---|---|---|---|
| Authentication gate | ✅ | **new** | Unauthenticated visitors are redirected to `sign-in.tsx`; Google/Outlook accounts provide identity only. Dev builds bypass the gate. |
| Separate calendar connection | ✅ | **new** | Settings starts a separate Google or Outlook calendar-read consent flow for the authenticated application account; provider identity and calendar-read access are verified before storage in a calendar-connection record separate from identities that establish application sessions. The server stores the calendar's tokens encrypted. Disconnect removes the calendar connection, its stored tokens, and its cached events without changing application sign-in identities. |
| Linked sign-in identities | ✅ | **new** | Settings links a second provider identity (Google or Microsoft) to the signed-in application account through an identity-only OAuth flow, so either identity signs in to the same account. At most one identity per provider per account; an identity owned by another account, as a sign-in identity or a calendar connection, is refused and accounts are never merged. Settings can remove a linked identity (`/auth/sign-in-identity-removal`) as long as another one remains, so the account can always be signed in to; calendar connections and sessions are unchanged. |
| Sign out | ✅ | **new** | Settings → Account → Sign out posts to `/auth/sign-out`, which revokes the server-side session, clears the cookie, and redirects to sign-in. Account data (identities, calendar connections, server cache) is never deleted by sign-out. |
| Server-side session | ✅ | **new** | Sessions are rows in PostgreSQL (`Session`), keyed by the SHA-256 hash of a 256-bit random token. The signed, HTTP-only cookie carries only the token. Every authenticated request resolves it server-side, so revocation and the 30-day lifetime are enforced by the server. Each sign-in issues a new session and revokes any previous one in that browser. |
| Persistent user store | ✅ | **new** | User records, application sign-in provider accounts, and calendar connections in PostgreSQL via Prisma, behind a `userRepository` interface so the driver stays swappable. |
| Server-side event cache | ✅ | **new** | Calendar events persisted in Postgres, keyed by user + provider + time range; shared across devices; past data never auto-removed. Replaces the old per-device `localStorage` cache. |
| Server-driven data flow | ✅ | **new** | The timeline reads events from a server `loader`, which fetches stale or missing windows from the providers with the account's stored credentials, refreshing expired access tokens. The browser makes no provider API calls. |
| Background calendar refresh | ✅ | **new** | `refreshCalendars` refreshes the near-future months of every connected calendar with stored credentials, without a signed-in user. It runs as a command-line job (`node build/jobs/refresh-calendars.js`) that any scheduler can invoke. |

---

## App shell & UX

| Feature | Status | Origin | Notes |
|---|---|---|---|
| Timeline view (main screen) | ✅ | carried over | `app/routes/home.tsx`. |
| Settings view | ✅ | carried over | `app/routes/settings.tsx` starts provider calendar connections and controls per-calendar visibility. |
| Navigation between views | ✅ | carried over | React Router links; `PeriodNavigator` for browsing periods within a view. |
| Light / dark mode | ✅ | carried over | vanilla-extract theme contract + `DarkModeToggle`. |
| Responsive layout (mobile → large desktop) | ✅ | **new** | `TimelineLayout`: below 1024 px of available width one column (header, view selector and navigator, circle, then the panel sections); from 1024 px the controls join the header row and the panel sits beside the circle. The circle fills its column up to 560 px. The layout uses container queries, so it follows the space it is given. |
| All-day events on the arch | ✅ | **new** | Day view: all-day events leave the ring and appear as icons on an arch above the circle (birthday, time off, other; up to 5, then "+N") and, on wide layouts, as chips in the All day panel section. Kinds come from provider metadata: Google `eventType` (`birthday`, `outOfOffice`) and Outlook `showAs: oof`. Cached months stored before kinds existed are refetched once. A holiday kind waits for multiple-calendar support. |
| Day agenda | ✅ | **new** | Day view: the day's timed events in order with start time (24 h), slice colour, title and calendar. Today, past events are muted and the next event is marked "Up next"; narrow layouts show only upcoming events until expanded. Events that cross the day's edges show their clamped time and "started earlier" / "ends later". A row opens the same `EventDetail` as its slice. Built on the client only, since it depends on the browser's clock and time zone. |
| Calendars legend | ✅ | **new** | `CalendarLegend` names the calendar behind each event ring by ring position (events keep their own colours). |
| Typography | ✅ | **new** | Self-hosted Hanken Grotesk (UI) and IBM Plex Mono (numerals and times), Latin subset, preloaded, `font-display: optional` so text never shifts on font load. |

---

## Engineering & quality

| Feature | Status | Origin | Notes |
|---|---|---|---|
| Storybook for every component | ✅ | **new** | Stories for `Circle`, `MultiCircle`, `SegmentedControl`, `PeriodNavigator`, `DarkModeToggle`, `ThemeProvider`. |
| Unit tests per component/module | ✅ | planned | 349 unit tests across timeline math, data layer, providers, hooks, and components. |
| Linting / formatting in CI | ✅ | carried over | CI enforces `typecheck`, `lint`, `format:check`, and `lint:md`. |
| Two-tier design tokens | ✅ | **new** | Tier-1 primitives feed tier-2 semantic tokens; components reference semantic roles only (Milestone 7.1). |
| Documented, stable component API | ✅ | planned | `Slice` / `CircleProps` / `MultiCircleProps` reviewed and JSDoc'd; single `index.ts` entry point; coupling test enforces extraction-readiness. |

---

## Out of scope (for now)

These are explicitly deferred so the roadmap stays focused:

- Publishing the timeline component as a standalone npm package. The component is being made *extraction-ready* (issue #2), but packaging and publishing are a follow-on effort.
- Production build, signing, app-store/PWA distribution.
