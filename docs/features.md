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
| Time navigation (browse to a specific day/week/month/year) | ✅ | planned | `PeriodNavigator` component with prev/label/next and a Today reset (Milestone 4.1). |

---

## Calendar data

| Feature | Status | Origin | Notes |
|---|---|---|---|
| Google Calendar integration | ✅ | planned | OAuth 2.0 PKCE + server-side token proxy (GCP Secret Manager); `GoogleCalendarProvider`. |
| Outlook Calendar integration | ✅ | planned | Microsoft Graph, secretless public PKCE client; `OutlookCalendarProvider`. |
| Local calendar access | ⏸ | planned (re-scoped) | `.ics`/CalDAV import. Deferred — no test service available (Milestone 3.5). |
| Per-calendar visibility filtering | ✅ | planned | `CalendarVisibilityStore` persists show/hide; settings toggles write through; timeline respects. |
| Refresh policy | ✅ | planned | Past = manual refresh only; near-future (≤1 day) = auto on open. Runs server-side to fetch only uncovered windows. |
| Secure credential storage | ✅ | planned | Provider OAuth tokens in `localStorage` (browser-standard); user identity in a signed HTTP-only session cookie; Google client secret in GCP Secret Manager, never in the image. |

---

## Identity & persistence

| Feature | Status | Origin | Notes |
|---|---|---|---|
| Authentication gate | ✅ | **new** | Unauthenticated visitors are redirected to `sign-in.tsx`; Google/Outlook accounts double as identity providers. Dev builds bypass the gate. |
| Server-side session | ✅ | **new** | Signed, HTTP-only cookie (`session.server.ts`) maps each request to a stable user ID without touching `localStorage`. |
| Persistent user store | ✅ | **new** | User records and linked provider accounts in PostgreSQL via Prisma, behind a `userRepository` interface so the driver stays swappable. |
| Server-side event cache | ✅ | **new** | Calendar events persisted in Postgres, keyed by user + provider + time range; shared across devices; past data never auto-removed. Replaces the old per-device `localStorage` cache. |
| Server-driven data flow | ✅ | **new** | The timeline reads events from a server `loader`; the client only fetches from provider APIs to warm a cold cache, then POSTs results to a route action. `useCalendarTimeline` is reduced to that optimistic warmer. |

---

## App shell & UX

| Feature | Status | Origin | Notes |
|---|---|---|---|
| Timeline view (main screen) | ✅ | carried over | `app/routes/home.tsx`. |
| Settings view | ✅ | carried over | `app/routes/settings.tsx` with real auth and per-calendar toggles. |
| Navigation between views | ✅ | carried over | React Router links; `PeriodNavigator` for browsing periods within a view. |
| Light / dark mode | ✅ | carried over | vanilla-extract theme contract + `DarkModeToggle`. |
| Responsive layout (mobile → large desktop) | ✅ | **new** | SVG scales to its container; layout adapts across breakpoints. Confirmed in the 4.2 parity pass. |

---

## Engineering & quality

| Feature | Status | Origin | Notes |
|---|---|---|---|
| Storybook for every component | ✅ | **new** | Stories for `Circle`, `MultiCircle`, `SegmentedControl`, `PeriodNavigator`, `DarkModeToggle`, `ThemeProvider`. |
| Unit tests per component/module | ✅ | planned | 348 unit tests across timeline math, data layer, providers, hooks, and components. |
| Linting / formatting in CI | ✅ | carried over | CI enforces `typecheck`, `lint`, `format:check`, and `lint:md`. |
| Two-tier design tokens | ✅ | **new** | Tier-1 primitives feed tier-2 semantic tokens; components reference semantic roles only (Milestone 7.1). |
| Documented, stable component API | ✅ | planned | `Slice` / `CircleProps` / `MultiCircleProps` reviewed and JSDoc'd; single `index.ts` entry point; coupling test enforces extraction-readiness. |

---

## Out of scope (for now)

These are explicitly deferred so the roadmap stays focused:

- Publishing the timeline component as a standalone npm package. The component is being made *extraction-ready* (issue #2), but packaging and publishing are a follow-on effort.
- Production build, signing, app-store/PWA distribution.
