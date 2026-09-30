import { useState, useEffect } from "react";
import { Link, redirect } from "react-router";
import type { Route } from "./+types/settings";
import { isProduction } from "../lib/buildConfig";
import { DarkModeToggle } from "../components/DarkModeToggle";
import {
  startGoogleCalendarConnection,
  startGoogleIdentityLink,
  startOutlookCalendarConnection,
  startOutlookIdentityLink,
} from "../lib/providerAuth";
import { GoogleTokenStore } from "../data/providers/google";
import { OutlookTokenStore } from "../data/providers/outlook";
import { CalendarVisibilityStore, CalendarCache } from "../data";
import {
  page,
  topBar,
  backLink,
  title,
  content,
  sectionTitle,
  calendarList,
  calendarItem,
  calendarIcon,
  calendarInfo,
  calendarName,
  calendarStatus,
  calendarActions,
  connectButton,
  disconnectButton,
  toggleLabel,
  toggleInput,
  toggleSlider,
} from "./settings.css";

export function meta() {
  return [{ title: "Settings — Circular Time" }];
}

/**
 * Settings manages the signed-in account's calendar connections, so it is
 * only served to an application session. Unauthenticated production requests
 * are redirected to sign-in before any settings markup is rendered, matching
 * the timeline route.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const { getUserId } = await import("../lib/session.server");
  const userId = await getUserId(request);
  if (!userId) {
    if (isProduction()) throw redirect("/sign-in");
    return null;
  }
  const { userRepository } = await import("../lib/userRepository.server");
  return { signInProviders: await userRepository.getSignInProviders(userId) };
}

/** Providers whose accounts can be linked as application sign-in identities. */
const IDENTITY_PROVIDERS = [
  { id: "google", name: "Google" },
  { id: "outlook", name: "Microsoft (Outlook)" },
] as const;

interface CalendarProvider {
  id: string;
  name: string;
  icon: string;
  connected: boolean;
  enabled: boolean;
}

const INITIAL_PROVIDERS: CalendarProvider[] = [
  { id: "google", name: "Google Calendar", icon: "📅", connected: false, enabled: false },
  { id: "outlook", name: "Outlook / Microsoft 365", icon: "📆", connected: false, enabled: false },
  { id: "ical", name: "iCal / CalDAV", icon: "🗓", connected: false, enabled: false },
];

function resolveProvidersFromStorage(): CalendarProvider[] {
  const visibility = new CalendarVisibilityStore();
  return INITIAL_PROVIDERS.map((p) => {
    const connected =
      (p.id === "google" && new GoogleTokenStore().get() != null) ||
      (p.id === "outlook" && new OutlookTokenStore().get() != null);
    if (!connected) {
      console.debug(`No connected provider found for ${p.id}; marking as disconnected.`);
      return p;
    }
    // A connected calendar's toggle reflects its persisted visibility.
    console.debug(
      `Connected provider found for ${p.id}; visibility is ${visibility.isVisible(p.id)}`
    );
    return { ...p, connected: true, enabled: visibility.isVisible(p.id) };
  });
}

export default function Settings({ loaderData }: Partial<Route.ComponentProps> = {}) {
  const [providers, setProviders] = useState<CalendarProvider[]>(INITIAL_PROVIDERS);
  // Development without a session has no application account to link to.
  const signInProviders = loaderData?.signInProviders ?? null;

  // Sync from localStorage after hydration — reading storage during SSR would
  // produce a server/client mismatch because localStorage is client-only.
  // Unlike the timeline's reference date (see lib/persistentState), providers
  // carry optimistic, non-persisted edits from the handlers below, so they are
  // not a pure external store; a one-shot post-hydration seed is correct here.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR-safe one-shot localStorage seed; see note above
    setProviders(resolveProvidersFromStorage());
  }, []);

  function toggleEnabled(id: string) {
    setProviders((ps) =>
      ps.map((p) => {
        if (p.id !== id) return p;
        const enabled = !p.enabled;
        new CalendarVisibilityStore().setVisible(id, enabled);
        return { ...p, enabled };
      })
    );
  }

  async function connect(id: string) {
    // A freshly-connected calendar starts visible, even if it was hidden before
    // a previous disconnect.
    new CalendarVisibilityStore().setVisible(id, true);
    if (id === "google") {
      const url = await startGoogleCalendarConnection();
      if (!url) {
        alert("Google Calendar is not configured for this build.");
        return;
      }
      window.location.assign(url);
      return;
    }
    if (id === "outlook") {
      const url = await startOutlookCalendarConnection();
      if (!url) {
        alert("Outlook Calendar is not configured for this build.");
        return;
      }
      window.location.assign(url);
      return;
    }
    // iCal auth lands in Milestone 3.5.
    if (id === "ical") {
      alert("iCal visibility toggled - no implementation yet.");
      return;
    }
    setProviders((ps) =>
      ps.map((p) => (p.id === id ? { ...p, connected: true, enabled: true } : p))
    );
  }

  async function disconnect(id: string) {
    if (id !== "google" && id !== "outlook") return;

    try {
      const response = await fetch("/auth/calendar-disconnection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: id }),
      });
      if (!response.ok) {
        throw new Error("Failed to remove calendar connection");
      }
    } catch {
      alert("Unable to disconnect the calendar. Try again.");
      return;
    }

    if (id === "google") {
      new GoogleTokenStore().clear();
    } else {
      new OutlookTokenStore().clear();
    }
    // Drop browser-cached events only after the server transaction removed the
    // provider connection and its server-side cache.
    new CalendarCache().remove(id);
    setProviders((ps) =>
      ps.map((p) => (p.id === id ? { ...p, connected: false, enabled: false } : p))
    );
  }

  // Browser-held calendar tokens and cached events belong to this account; drop
  // them before the form clears the server session, so the next person to use
  // this browser starts clean. Server-side connections and identities remain.
  function clearBrowserAccountData() {
    new GoogleTokenStore().clear();
    new OutlookTokenStore().clear();
    new CalendarCache().clear();
  }

  async function linkIdentity(id: string) {
    const url =
      id === "google" ? await startGoogleIdentityLink() : await startOutlookIdentityLink();
    if (!url) {
      alert("This sign-in provider is not configured for this build.");
      return;
    }
    window.location.assign(url);
  }

  return (
    <div className={page}>
      <header className={topBar}>
        <Link to="/" className={backLink}>
          ← Back
        </Link>
        <h1 className={title}>Settings</h1>
        <DarkModeToggle />
      </header>

      <main className={content}>
        {signInProviders && (
          <>
            <h2 className={sectionTitle}>Sign-in accounts</h2>
            <ul className={calendarList} aria-label="Sign-in accounts">
              {IDENTITY_PROVIDERS.map((provider) => {
                const linked = signInProviders.includes(provider.id);
                return (
                  <li key={provider.id} className={calendarItem}>
                    <div className={calendarInfo}>
                      <p className={calendarName}>{provider.name}</p>
                      <p className={calendarStatus}>
                        {linked ? "Can sign in to this account" : "Not linked"}
                      </p>
                    </div>
                    {!linked && (
                      <div className={calendarActions}>
                        <button
                          type="button"
                          className={connectButton}
                          onClick={() => linkIdentity(provider.id)}
                          aria-label={`Link ${provider.name} account`}
                        >
                          Link
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <h2 className={sectionTitle}>Calendars</h2>
        <ul className={calendarList} aria-label="Calendar providers">
          {providers.map((provider) => (
            <li key={provider.id} className={calendarItem}>
              <span className={calendarIcon} aria-hidden="true">
                {provider.icon}
              </span>
              <div className={calendarInfo}>
                <p className={calendarName}>{provider.name}</p>
                <p className={calendarStatus}>
                  {provider.connected ? "Connected" : "Not connected"}
                </p>
              </div>
              <div className={calendarActions}>
                {provider.connected ? (
                  <>
                    <label className={toggleLabel}>
                      <input
                        type="checkbox"
                        className={toggleInput}
                        checked={provider.enabled}
                        onChange={() => toggleEnabled(provider.id)}
                        aria-label={`Enable ${provider.name}`}
                      />
                      <span className={toggleSlider} />
                    </label>
                    <button
                      type="button"
                      className={disconnectButton}
                      onClick={() => disconnect(provider.id)}
                    >
                      Disconnect
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className={connectButton}
                    onClick={() => connect(provider.id)}
                  >
                    Connect
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>

        {signInProviders && (
          <>
            <h2 className={sectionTitle}>Account</h2>
            <form method="post" action="/auth/sign-out" onSubmit={clearBrowserAccountData}>
              <button type="submit" className={disconnectButton}>
                Sign out
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
