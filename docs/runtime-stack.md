# app runtime stack

Where each piece of code runs, and how data crosses the browser/server boundary.

The server is now the authoritative layer: a signed session identifies the user, and the timeline reads events from a server loader backed by a Postgres event cache. Provider API calls still happen in the browser (OAuth tokens stay client-side); the client warms the server cache by POSTing fetched events to a route action. See [architecture.md](architecture.md) for the layering and [features.md](features.md) for status.

Route modules sit under **Browser** because that is where their components ultimately run; the server's role for them is the one-time SSR render plus executing their `loader`/`action` (the arrow from `home loader + action`).

```mermaid
graph TD
    subgraph Browser["Browser"]
        subgraph UI["UI Layer"]
            signin["sign-in.tsx"]
            home["home.tsx"]
            settings["settings.tsx"]
            cbs["OAuth callbacks\nauth.google · auth.outlook"]
            comps["Components\nMultiCircle · EventDetail · SegmentedControl · PeriodNavigator"]
        end

        subgraph BL["Business Logic"]
            hook["useCalendarTimeline\n(cold-cache warmer)"]
            lib["lib/\ncalendarTimeline · timeSlices · timeNavigation"]
        end

        subgraph DP["Data Providers"]
            gp["GoogleCalendarProvider"]
            op["OutlookCalendarProvider"]
        end

        subgraph CS["Client Storage"]
            ls["localStorage\nGoogleTokenStore · OutlookTokenStore\nCalendarVisibilityStore"]
            ss["sessionStorage\nPKCE verifier · PKCE state"]
        end
    end

    subgraph CloudRun["Server — Cloud Run"]
        ld["home loader + action\n(server-driven data flow)"]
        sess["session.server\n(signed HTTP-only cookie)"]
        sec["serverEventCache · userRepository"]
        proxy["/auth/google/token\nToken Proxy"]
        sm["secretManager.server"]
    end

    subgraph Data["Server Data"]
        db[("Postgres\nvia Prisma\nusers · cached events")]
    end

    subgraph Ext["External Services"]
        gcal["Google Calendar API"]
        goauth["Google OAuth"]
        gsm["GCP Secret Manager"]
        mggraph["Microsoft Graph API"]
        msoauth["Microsoft OAuth"]
    end

    ld -->|"SSR render"| signin & home & settings & cbs
    home --> comps & hook
    ld -->|"read cached events for user"| sec
    home -->|"POST fetched events"| ld
    sess -->|"resolve userId"| ld
    sec --> db
    sess --> db

    settings -->|"read token presence"| ls
    cbs -->|"read PKCE secrets"| ss
    cbs -->|"write tokens; establish session"| ls
    cbs -->|"POST code + verifier"| proxy
    cbs -->|"token exchange"| goauth & msoauth

    proxy --> sm --> gsm
    proxy -->|"token exchange"| goauth

    hook --> gp & op
    hook -->|"read visibility"| ls
    gp -->|"read token"| ls
    gp --> gcal
    op -->|"read token"| ls
    op --> mggraph
```
