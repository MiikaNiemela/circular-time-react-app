import { useState, useEffect } from "react";
import { Link } from "react-router";
import { DarkModeToggle } from "../components/DarkModeToggle";
import { startGoogleAuth, GoogleTokenStore } from "../data/providers/google";
import {
  GOOGLE_CLIENT_ID,
  googleRedirectUri,
  isGoogleConfigured,
} from "../data/providers/google/config";
import { startOutlookAuth, OutlookTokenStore } from "../data/providers/outlook";
import {
  OUTLOOK_CLIENT_ID,
  outlookRedirectUri,
  isOutlookConfigured,
} from "../data/providers/outlook/config";
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

export default function Settings() {
  const [providers, setProviders] = useState<CalendarProvider[]>(INITIAL_PROVIDERS);

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
      console.debug("calendar visibility change - starting Google OAuth flow...");
      if (!isGoogleConfigured()) {
        alert("Google Calendar is not configured for this build.");
        return;
      }
      // Redirect into Google's consent screen; the callback finishes the flow.
      const url = await startGoogleAuth({
        clientId: GOOGLE_CLIENT_ID,
        redirectUri: googleRedirectUri(window.location.origin),
      });
      console.debug("redirecting to Google OAuth consent screen...");
      window.location.assign(url);
      return;
    }
    if (id === "outlook") {
      console.debug("calendar visibility change - starting Outlook OAuth flow...");
      if (!isOutlookConfigured()) {
        alert("Outlook Calendar is not configured for this build.");
        return;
      }
      const url = await startOutlookAuth({
        clientId: OUTLOOK_CLIENT_ID,
        redirectUri: outlookRedirectUri(window.location.origin),
      });
      console.debug("redirecting to Outlook OAuth consent screen...");
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

  function disconnect(id: string) {
    if (id === "google") {
      console.debug("disconnecting Google Calendar...");
      new GoogleTokenStore().clear();
    }
    if (id === "outlook") {
      console.debug("disconnecting Outlook Calendar...");
      new OutlookTokenStore().clear();
    }
    if (id === "ical") {
      console.debug("disconnecting iCal Calendar (no-op)...");
      // No storage to clear for iCal since there's no implementation yet.
    }
    // Drop cached events so a disconnected calendar leaves nothing behind.
    new CalendarCache().remove(id);
    setProviders((ps) =>
      ps.map((p) => (p.id === id ? { ...p, connected: false, enabled: false } : p))
    );
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
      </main>
    </div>
  );
}
