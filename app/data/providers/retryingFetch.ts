/**
 * A `fetch` wrapper for calendar provider reads. It bounds every attempt with
 * a timeout and retries the failures that are likely to pass on another try:
 * rate limiting, provider-side errors, network failures, and timeouts.
 *
 * A retried request is sent again unchanged, so only idempotent requests
 * belong here.
 */

/** Statuses that signal a temporary condition on the provider's side. */
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

export interface RetryOptions {
  /** Total tries, including the first. */
  maxAttempts?: number;
  /** Time allowed for one attempt, from sending it to reading its body. */
  timeoutMs?: number;
  /** Upper bound of the wait before the first retry; it doubles per retry. */
  baseDelayMs?: number;
  /** Longest wait between attempts, and the longest `Retry-After` honoured. */
  maxDelayMs?: number;
  /** Marks a response as retryable when its status alone does not. */
  isRetryable?: (res: Response) => Promise<boolean>;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  now?: () => Date;
}

/** Reads `Retry-After`, a number of seconds or an HTTP date, as a wait in ms. */
function retryAfterMs(res: Response, now: Date): number | null {
  const value = res.headers.get("Retry-After");
  if (!value) return null;
  const seconds = Number(value);
  const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now.getTime();
  return Number.isNaN(ms) ? null : Math.max(0, ms);
}

/**
 * Wraps `fetchFn` with a per-attempt timeout and retries. A response that is
 * still failing after the last attempt is returned as it is, so the caller
 * reports its status; a network failure or timeout on the last attempt throws.
 */
export function retryingFetch(fetchFn: typeof fetch, options: RetryOptions = {}): typeof fetch {
  const {
    maxAttempts = 3,
    timeoutMs = 10_000,
    baseDelayMs = 500,
    maxDelayMs = 5_000,
    isRetryable = async () => false,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    random = Math.random,
    now = () => new Date(),
  } = options;

  // Full jitter keeps clients that failed together from retrying together.
  const backoffMs = (attempt: number) =>
    random() * Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));

  return async (input, init) => {
    for (let attempt = 1; ; attempt++) {
      const last = attempt >= maxAttempts;
      const timeout = AbortSignal.timeout(timeoutMs);
      const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;

      let res: Response;
      try {
        res = await fetchFn(input, { ...init, signal });
      } catch (error: unknown) {
        // A network failure or timeout; the caller's own abort is not retried.
        if (last || init?.signal?.aborted) throw error;
        await sleep(backoffMs(attempt));
        continue;
      }

      if (res.ok || last) return res;
      if (!RETRYABLE_STATUSES.has(res.status) && !(await isRetryable(res))) return res;

      const retryAfter = retryAfterMs(res, now());
      // The provider asked for a longer wait than we allow; retrying sooner
      // would only fail again.
      if (retryAfter != null && retryAfter > maxDelayMs) return res;

      // Release the connection held by the unread body.
      await res.body?.cancel().catch(() => undefined);
      await sleep(retryAfter ?? backoffMs(attempt));
    }
  };
}
