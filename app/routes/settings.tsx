import { useState, useEffect, type ReactNode } from "react";
import { Link, redirect } from "react-router";
import type { Route } from "./+types/settings";
import { isProduction } from "../lib/buildConfig";
import { DarkModeToggle } from "../components/DarkModeToggle";
import { CalendarVisibilityStore } from "../data";
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
  const [signInProviders, connectedProviders] = await Promise.all([
    userRepository.getSignInProviders(userId),
    userRepository.getConnectedProviders(userId),
  ]);
  return { signInProviders, connectedProviders };
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

/**
 * Server-side connection state. Without a visibility store every connected
 * calendar is shown, which is also what the server renders; the browser's
 * stored visibility is merged in after hydration.
 */
function resolveProviders(
  connectedProviders: readonly string[],
  visibility?: CalendarVisibilityStore
): CalendarProvider[] {
  return INITIAL_PROVIDERS.map((p) =>
    connectedProviders.includes(p.id)
      ? { ...p, connected: true, enabled: visibility?.isVisible(p.id) ?? true }
      : p
  );
}

/** Starts a server-side OAuth flow: the server redirects to the provider. */
function OAuthStartForm({
  provider,
  intent,
  label,
  children,
  onSubmit,
}: {
  provider: "google" | "outlook";
  intent: "link-identity" | "connect-calendar";
  label: string;
  children: ReactNode;
  onSubmit?: () => void;
}) {
  return (
    <form method="post" action={`/auth/${provider}/start`} onSubmit={onSubmit}>
      <input type="hidden" name="intent" value={intent} />
      <button type="submit" className={connectButton} aria-label={label}>
        {children}
      </button>
    </form>
  );
}

export default function Settings({ loaderData }: Partial<Route.ComponentProps> = {}) {
  // Development without a session has no application account to link to.
  const signInProviders = loaderData?.signInProviders ?? null;
  const connectedProviders = loaderData?.connectedProviders;
  const [providers, setProviders] = useState<CalendarProvider[]>(() =>
    resolveProviders(connectedProviders ?? [])
  );

  // Connection state comes from the server; visibility is a browser preference,
  // so it is applied after hydration to keep the server and client renders equal.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR-safe localStorage merge after hydration
    setProviders(resolveProviders(connectedProviders ?? [], new CalendarVisibilityStore()));
  }, [connectedProviders]);

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

    // The server removed the connection, its stored credentials, and its cached events.
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
                        <OAuthStartForm
                          provider={provider.id}
                          intent="link-identity"
                          label={`Link ${provider.name} account`}
                        >
                          Link
                        </OAuthStartForm>
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
                ) : provider.id === "google" || provider.id === "outlook" ? (
                  <OAuthStartForm
                    provider={provider.id}
                    intent="connect-calendar"
                    label={`Connect ${provider.name}`}
                    // A freshly-connected calendar starts visible, even if it
                    // was hidden before a previous disconnect.
                    onSubmit={() => new CalendarVisibilityStore().setVisible(provider.id, true)}
                  >
                    Connect
                  </OAuthStartForm>
                ) : (
                  <button
                    type="button"
                    className={connectButton}
                    // iCal lands in Milestone 3.5.
                    onClick={() => alert("iCal visibility toggled - no implementation yet.")}
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
            <form method="post" action="/auth/sign-out">
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
