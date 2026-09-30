# circular-time-react-app

Application showing different timelines in intuitive circular patterns.

Circular Time visualises calendar events as an **interactive circular timeline**. Time is drawn as a circle split into segments (slices) — with Day, Week, Month, and Year views — so you can see your schedule from Google Calendar, Outlook, and local calendars at a glance, in a format that ordinary linear calendars don't offer.

This repository is the **React (web) successor** to the original [React Native app](https://github.com/MiikaNiemela/circular-time-app). It has reached feature parity with that app, and the React Native repository is now archived.

> Status: **feature-complete to parity.** The circular timeline, Day/Week/Month/Year views, Google and Outlook calendar integration, per-calendar visibility, user identity with server-side sessions, and a server-side event cache are all in place.

---

## Accounts and calendar access

Sign in creates or resumes a Circular Time application session using a Google or
Microsoft account as identity. Signing in does not grant access to calendar
data.

To read calendar events, open **Settings** and select **Connect** next to
Google Calendar or Outlook / Microsoft 365. The provider then asks separately
for calendar-read permission. On approval, the calendar is connected to the
signed-in Circular Time account and returns to Settings. Calendar connections
are stored separately from identities that create application sessions, so a
calendar connection cannot create or merge application accounts.

One Circular Time account can be signed in to with both a Google and a
Microsoft account. While signed in, open **Settings** and select **Link** under
**Sign-in accounts** to add the other provider. Linking asks only for identity,
not calendar access. An account links at most one identity per provider. A
Google or Microsoft account that already belongs to a different Circular Time
account is refused; accounts are never merged.

## Database schema

Prisma schema changes are version-controlled in `prisma/migrations/`. Use
`npx prisma migrate dev` against a local development database and
`npx prisma migrate deploy` before starting an environment on a new application
revision. Database connection values remain deployment secrets.

### Baseline reconciliation

A database created directly from the M9 schema has no Prisma migration history.
Mark the M9 baseline as applied, then run the additive migration:

```sh
npx prisma migrate resolve --applied 20260926000000_baseline_m9_schema
npx prisma migrate deploy
```

The migration copies connected-provider state and its matching cached ranges to
explicit calendar connections before replacing the legacy connection flag.

---

## Why this project exists

Three goals, in order:

1. **Feature parity** with the original React Native app — reached, and the original is now retired.
2. **Support every viewport** — usable on phones and on large desktop displays, which the mobile-only predecessor was not.
3. **Learn in the open** — the project doubles as a portfolio piece, so the code, tests, and documentation are written to be read.

Each piece of work is scoped to land as **one releasable item**: a tested module, or a component that can be validated in Storybook — never a half-wired change.

---

## Tech stack

| Concern | Choice | Notes |
| --- | --- | --- |
| Framework | [React Router v7](https://reactrouter.com) (framework mode) | Routing, SSR, data loading |
| Styling | [vanilla-extract](https://vanilla-extract.style) | Type-safe, zero-runtime CSS; themeable for light/dark + responsive |
| Component workshop | [Storybook](https://storybook.js.org) | Every component is developed and validated here in isolation |
| Language | TypeScript | |
| Graphics | SVG | Circular timeline is hand-rendered SVG arcs (ported from the RN `react-native-svg` version) |
| Testing | [Vitest](https://vitest.dev) + Testing Library | Unit tests ship with each component; Storybook stories double as component tests |

> The original app used React Native 0.76, Expo, `react-native-svg`, and React Navigation; this project uses the web equivalents listed above.

---

## Getting started

### Project layout

- `app/root.tsx` is the root layout and error boundary.
- `app/routes.ts` defines the route contract; the route modules live in `app/routes/` (timeline, settings, sign-in, and the OAuth callback/token routes).
- `app/components/` holds shared React components, including the extraction-ready circular timeline in `app/components/timeline/`.
- `app/lib/` holds the business logic — timeline math, refresh policy, auth orchestration — with a co-located unit test per module.
- `app/data/` holds the data layer: calendar providers (`app/data/providers/`) and server-side database access (`app/data/db/`).
- `app/styles/` holds the vanilla-extract theme contract and responsive breakpoints.
- `public/` contains static files served from the app root.

The three layers keep strict boundaries — UI never touches calendar APIs directly. See [`docs/architecture.md`](docs/architecture.md) for the full picture.

## Commands

```sh
npm i
npm run start
npm test
npm run typecheck
```

Node version is pinned via `.nvmrc`.

---

## Documentation

| Document | What's in it |
| --- | --- |
| [`docs/README.md`](docs/README.md) | Index of all project documentation |
| [`docs/features.md`](docs/features.md) | Features and their status |
| [`docs/architecture.md`](docs/architecture.md) | Architecture of the web app (layers, components, data flow) |
| [`docs/runtime-stack.md`](docs/runtime-stack.md) | Where each piece of code runs — browser, server, external services |

---

## Relationship to the original app

| | Original | This repo |
| --- | --- | --- |
| Repository | [`circular-time-app`](https://github.com/MiikaNiemela/circular-time-app) | [`circular-time-react-app`](https://github.com/MiikaNiemela/circular-time-react-app) |
| Platform | iOS + Android (mobile only) | Web — mobile through large desktop |
| Framework | React Native + Expo | React Router v7 (framework mode) |
| Fate | Retired — parity reached, repo archived | Active |

The circular timeline component — made encapsulation-ready per [issue #2 on the original repo](https://github.com/MiikaNiemela/circular-time-app/issues/2) — is the seed of this app's component library and can be lifted out as a standalone package later.
