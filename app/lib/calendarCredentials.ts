/**
 * Server-side custody of provider OAuth credentials for calendar connections.
 *
 * Tokens are encrypted before they reach the repository and decrypted only on
 * the server when a calendar is read. The browser never receives them.
 */

/** Persistence for encrypted credentials; implementations see ciphertext only. */
export interface CalendarCredentialRepository {
  /** Creates or replaces the credential for a user's calendar connection. */
  save(userId: string, calendarConnectionId: string, ciphertext: string): Promise<void>;
  /** Returns the stored ciphertext, or null when none exists for this user. */
  load(userId: string, calendarConnectionId: string): Promise<string | null>;
}

/** Provider OAuth tokens as held by the server. */
export interface StoredCredential {
  accessToken: string;
  refreshToken?: string;
  /** Epoch milliseconds when the access token expires. */
  expiresAt: number;
}

/** Symmetric encryption bound to a context (see tokenCipher.server). */
export interface CredentialCipher {
  encrypt(plaintext: string, context: string): string;
  decrypt(payload: string, context: string): string;
}

/** Thrown when a calendar must be reconnected before it can be read again. */
export class ReconnectRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReconnectRequiredError";
  }
}

/** Refreshes an access token; returns the new credential. */
export type CredentialRefresher = (refreshToken: string) => Promise<StoredCredential>;

/** Renew access tokens this long before they expire, to absorb clock skew. */
const EXPIRY_MARGIN_MS = 60_000;

/** The encryption context binds a ciphertext to one user's connection. */
function context(userId: string, calendarConnectionId: string): string {
  return `calendar-credential:${userId}:${calendarConnectionId}`;
}

/** Encrypts, stores, loads, and refreshes provider credentials. */
export class CalendarCredentialStore {
  constructor(
    private readonly repository: CalendarCredentialRepository,
    private readonly cipher: CredentialCipher,
    private readonly now: () => Date = () => new Date()
  ) {}

  /** Encrypts a credential bound to the user's connection, for storage. */
  seal(userId: string, calendarConnectionId: string, credential: StoredCredential): string {
    return this.cipher.encrypt(JSON.stringify(credential), context(userId, calendarConnectionId));
  }

  /** Encrypts and stores the credential for the user's connection. */
  async save(userId: string, calendarConnectionId: string, credential: StoredCredential) {
    await this.repository.save(
      userId,
      calendarConnectionId,
      this.seal(userId, calendarConnectionId, credential)
    );
  }

  /**
   * Returns a valid access token for the user's connection, refreshing and
   * re-storing the credential when the access token is about to expire.
   * Throws {@link ReconnectRequiredError} when no usable credential remains.
   */
  async accessToken(
    userId: string,
    calendarConnectionId: string,
    refresh: CredentialRefresher
  ): Promise<string> {
    const ciphertext = await this.repository.load(userId, calendarConnectionId);
    if (!ciphertext) {
      throw new ReconnectRequiredError("Calendar credentials are missing; reconnect required");
    }
    let credential: StoredCredential;
    try {
      credential = JSON.parse(
        this.cipher.decrypt(ciphertext, context(userId, calendarConnectionId))
      ) as StoredCredential;
    } catch {
      // A rotated key or a ciphertext from another row cannot be used.
      throw new ReconnectRequiredError("Calendar credentials are unreadable; reconnect required");
    }
    if (credential.expiresAt - EXPIRY_MARGIN_MS > this.now().getTime()) {
      return credential.accessToken;
    }
    if (!credential.refreshToken) {
      throw new ReconnectRequiredError("Calendar access expired; reconnect required");
    }
    let refreshed: StoredCredential;
    try {
      refreshed = await refresh(credential.refreshToken);
    } catch {
      throw new ReconnectRequiredError(
        "Calendar access was revoked or expired; reconnect required"
      );
    }
    await this.save(userId, calendarConnectionId, refreshed);
    return refreshed.accessToken;
  }
}
