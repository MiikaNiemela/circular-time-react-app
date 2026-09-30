/**
 * Abstract repository for server-side application sessions. The session token
 * is an opaque bearer secret held only in the signed cookie; implementations
 * store a one-way hash of it, never the token itself.
 */
export interface SessionRepository {
  /** Creates a session for the user and returns its new opaque token. */
  create(userId: string, expiresAt: Date): Promise<string>;
  /** Returns the session's user when the token is known and not expired. */
  findUserId(token: string, now: Date): Promise<string | null>;
  /** Revokes the session. Unknown tokens are ignored. User data is unaffected. */
  revoke(token: string): Promise<void>;
}
