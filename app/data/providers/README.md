# Calendar providers

Each subfolder implements the `CalendarProvider` interface (`app/data/types.ts`)
for one calendar source. Providers are pure data sources: given a `TimeRange`
they return normalised `CalendarEvent[]`. Auth, caching, and refresh
orchestration live above them.

## OAuth

Google and Microsoft are both registered as confidential web clients. The
server runs the whole OAuth 2.0 authorization-code flow with PKCE (see
`app/lib/oauthFlow.server.ts`): it generates the verifier and state, redirects
the browser to the provider, redeems the code with the client secret, and keeps
the resulting tokens. The browser never receives a client secret or a provider
token.

| File                      | Responsibility                                                   |
| ------------------------- | ---------------------------------------------------------------- |
| `oauthClient.server.ts`   | Token endpoint client: code exchange and refresh, with a secret. |
| `clientSecrets.server.ts` | Reads each client secret from Secret Manager by resource name.   |
| `google/pkce.ts`          | Verifier/challenge/state generation (Web Crypto, S256).          |
| `*/auth.ts`               | Scopes and the pure `buildAuthUrl` for each provider.            |
| `*/config.ts`             | Client ID and redirect URI helpers.                              |
| `*/…CalendarProvider.ts`  | `CalendarProvider` implementation: fetch and map events.         |

Providers take an `accessToken()` supplier instead of holding tokens, so the
server decides where a valid token comes from (see
`app/lib/calendarCredentials.ts`).

## Configuration

- `VITE_GOOGLE_CLIENT_ID`, `VITE_OUTLOOK_CLIENT_ID` — public client IDs, build
  time.
- `GOOGLE_CLIENT_SECRET`, `OUTLOOK_CLIENT_SECRET` — the client secret values,
  supplied at runtime. Used for local development and by container runtimes
  that inject secrets as environment variables.
- `GOOGLE_CLIENT_SECRET_RESOURCE`, `OUTLOOK_CLIENT_SECRET_RESOURCE` — Google
  Secret Manager resource names of the client secrets, read at runtime by the
  runtime identity. A value set directly takes precedence.

Client secrets are never stored in the image or the repository.

- `TOKEN_ENCRYPTION_KEY` — 32-byte base64 key that encrypts stored provider
  tokens (AES-256-GCM).

Each provider app registration lists `<origin>/auth/<provider>/callback` as a
web redirect URI. The Microsoft registration uses the **Web** platform, not
Single-page application: Microsoft only redeems single-page-application codes
from a browser, and issues those clients refresh tokens that expire after 24
hours.
