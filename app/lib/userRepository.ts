/**
 * Abstract repository interface for application-account persistence.
 * Business logic targets this interface; the concrete driver is swappable
 * without modifying callers — required for portability across cloud platforms.
 */

/** Reports whether a provider identity can be linked without account merging. */
export type ProviderAccountLinkResult = "linked" | "conflict";
/** Reports whether calendar access was connected without an ownership conflict. */
export type CalendarConnectionResult = "connected" | "conflict";

/**
 * Contract for application-account persistence.
 */
export interface UserRepository {
  /** Resolves a provider identity to its application account, creating one on first sign-in. */
  signInWithProvider(provider: string, providerUserId: string): Promise<string>;
  /** Links a provider identity to an existing account without merging accounts. */
  linkProviderAccount(
    userId: string,
    provider: string,
    providerUserId: string
  ): Promise<ProviderAccountLinkResult>;
  /** Links a provider identity and marks that provider as calendar-connected. */
  connectCalendarProvider(
    userId: string,
    provider: string,
    providerUserId: string
  ): Promise<CalendarConnectionResult>;
  /** Returns the provider IDs (e.g. `"google"`, `"outlook"`) with active calendar access. */
  getConnectedProviders(userId: string): Promise<string[]>;
}
