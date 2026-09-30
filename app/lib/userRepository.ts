/**
 * Abstract repository interface for application-account persistence.
 * Business logic targets this interface; the concrete driver is swappable
 * without modifying callers — required for portability across cloud platforms.
 */

/**
 * Reports the outcome of linking a provider identity to an application account.
 * - `linked`: the identity now signs in to the account (idempotent for the same owner).
 * - `conflict`: the identity belongs to a different application account; accounts
 *   are never merged.
 * - `provider-already-linked`: the account already has a different identity from
 *   this provider; an account links at most one identity per provider.
 */
export type ProviderAccountLinkResult = "linked" | "conflict" | "provider-already-linked";
/** Reports whether calendar access was connected without an ownership conflict. */
export type CalendarConnectionResult = "connected" | "conflict";

/** Reports whether a sign-in identity established a session or is calendar-only. */
export type ProviderSignInResult =
  | { kind: "signed-in"; userId: string }
  | { kind: "calendar-only" };

/** An active calendar identity authorized for a specific application account. */
export interface CalendarConnection {
  id: string;
  provider: string;
  providerUserId: string;
}

/**
 * Contract for application-account persistence.
 */
export interface UserRepository {
  /** Resolves a provider identity atomically, without allowing a calendar-only identity to establish an application session. */
  signInWithProvider(provider: string, providerUserId: string): Promise<ProviderSignInResult>;
  /**
   * Links a provider identity to an existing account without merging accounts.
   * The account's own calendar connection for the same identity does not block
   * linking; another account's sign-in identity or calendar connection does.
   */
  linkProviderAccount(
    userId: string,
    provider: string,
    providerUserId: string
  ): Promise<ProviderAccountLinkResult>;
  /**
   * Creates a separate verified calendar connection, or reuses the user's
   * existing one, and stores its sealed credential in the same transaction:
   * either both are persisted or neither is. `sealCredential` receives the
   * connection ID and returns the ciphertext to store. A connection cannot
   * establish an application session.
   */
  connectCalendarProvider(
    userId: string,
    provider: string,
    providerUserId: string,
    sealCredential: (calendarConnectionId: string) => string
  ): Promise<CalendarConnectionResult>;
  /** Removes one provider's calendar connection and all of its cached events without changing application identities. */
  disconnectCalendarProvider(userId: string, provider: string): Promise<void>;
  /** Returns one active connection only when its immutable ID belongs to the user. */
  getCalendarConnection(
    userId: string,
    calendarConnectionId: string
  ): Promise<CalendarConnection | null>;
  /** Returns a provider's immutable calendar-connection ID for an authorized cache write. */
  getCalendarConnectionId(userId: string, provider: string): Promise<string | null>;
  /** Returns each provider's immutable ID and identity for a user's active calendar connections. */
  getCalendarConnections(userId: string): Promise<CalendarConnection[]>;
  /** Returns the provider IDs whose identities can sign in to the application account. */
  getSignInProviders(userId: string): Promise<string[]>;
  /** Returns the provider IDs (e.g. `"google"`, `"outlook"`) with active calendar access. */
  getConnectedProviders(userId: string): Promise<string[]>;
}
