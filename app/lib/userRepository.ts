/**
 * Abstract repository interface for user persistence.
 * Business logic targets this interface; the concrete driver is swappable
 * without modifying callers — required for portability across cloud platforms.
 */

/**
 * Retrieves or creates a user record keyed by OAuth provider identity,
 * returning the stable database user ID (UUID).
 */
export interface UserRepository {
  upsertUser(provider: string, providerUserId: string): Promise<string>;
  /** Returns the provider IDs (e.g. `"google"`, `"outlook"`) linked to a user. */
  getConnectedProviders(userId: string): Promise<string[]>;
}
