# Calendar providers

Each subfolder implements the `CalendarProvider` interface (`app/data/types.ts`)
for one calendar source. Providers are pure data sources: given a `TimeRange`
they return normalised `CalendarEvent[]`. Auth, caching, and refresh
orchestration live above them.

## `google/`

Google Calendar via OAuth 2.0 **Authorization Code + PKCE**. The browser does
the full PKCE handshake, but Google "Web application" clients are _confidential_
and require the `client_secret` on the token exchange even with PKCE (the spec
allows secretless PKCE; Google's web client type does not — only its
Desktop/iOS/Android types do, and those forbid `https://` redirect URIs).

So the token exchange/refresh is proxied through a same-origin server route
(`routes/auth.google.token.tsx` → `tokenProxy.ts`) that injects the credentials
server-side. The browser never sees the secret.

Credentials:

- `VITE_GOOGLE_CLIENT_ID` — public client ID, build-time (browser).
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — server-side runtime env on
  Cloud Run, supplied from GitHub secrets by the deploy workflow.

Module layout (split so the whole flow is unit-testable without a browser or
live Google — network calls take an injectable `fetch`):

| File                        | Responsibility                                                 |
| --------------------------- | -------------------------------------------------------------- |
| `pkce.ts`                   | Verifier/challenge/state generation (Web Crypto, S256).        |
| `auth.ts`                   | Pure `buildAuthUrl` + injectable-fetch token exchange/refresh. |
| `tokenStore.ts`             | Token persistence behind injectable storage; expiry check.     |
| `browserAuth.ts`            | Cross-redirect orchestration (sessionStorage handshake).       |
| `GoogleCalendarProvider.ts` | `CalendarProvider` impl: fetch + map events.                   |
| `config.ts`                 | Build-time client ID + redirect URI helpers.                   |

The OAuth round-trip is wired through `routes/auth.google.callback.tsx` and the
"Connect" button in `routes/settings.tsx`.

### Security note

Tokens are stored in `localStorage` — the simplest option for a public PKCE
client (chosen deliberately). The tradeoff is XSS exposure; there is no client
secret to leak. To harden later, move `tokenStore.ts` behind an HttpOnly cookie
set by a server route — the rest of the provider is unaffected.
