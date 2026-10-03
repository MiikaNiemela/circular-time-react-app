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

/** Statuses whose response must not carry a body. */
const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);

export interface RetryOptions {
  /** Total tries, including the first. */
  maxAttempts?: number;
  /** Time allowed for one attempt, from sending it to reading its body. */
  timeoutMs?: number;
  /** Upper bound of the wait before the first retry; it doubles per retry. */
  baseDelayMs?: number;
  /** Longest wait between attempts, and the longest `Retry-After` honoured. */
  maxDelayMs?: number;
  /**
   * Total time for every request made through the wrapped fetch, counted from
   * its first request. No attempt or wait runs past it. Unbounded if omitted.
   */
  budgetMs?: number;
  /** Marks a response as retryable when its status alone does not. */
  isRetryable?: (res: Response) => Promise<boolean>;
  /** Waits `ms`; rejects with the signal's reason as soon as it aborts. */
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  random?: () => number;
  now?: () => Date;
}

/**
 * For reads a person is waiting on: fail fast, so the loader can serve the
 * cache instead. The whole read, every month and page, shares one budget.
 */
export const INTERACTIVE_RETRY: RetryOptions = {
  maxAttempts: 2,
  timeoutMs: 4_000,
  maxDelayMs: 1_000,
  budgetMs: 8_000,
};

/**
 * For the background refresh: more patience per request, and a budget that
 * keeps one struggling connection from using up the job's run time.
 */
export const BACKGROUND_RETRY: RetryOptions = {
  budgetMs: 120_000,
};

/** A signal that aborts with a `TimeoutError` after `ms`, and its cleanup. */
function timeoutSignal(ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new DOMException("The operation timed out.", "TimeoutError")),
    ms
  );
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
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
 * Sends one attempt and reads its whole body under `signal`, so a body that
 * stalls fails this attempt instead of the caller's later read.
 */
async function attempt(
  fetchFn: typeof fetch,
  input: Parameters<typeof fetch>[0],
  init: RequestInit | undefined,
  signal: AbortSignal
): Promise<Response> {
  const res = await fetchFn(input, { ...init, signal });
  const body = NULL_BODY_STATUSES.has(res.status) ? null : await res.arrayBuffer();
  return new Response(body, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
}

/**
 * Wraps `fetchFn` with a per-attempt timeout, an optional overall budget, and
 * retries. A response that is still failing when the attempts or the budget
 * run out is returned as it is, so the caller reports its status; a network
 * failure or timeout then throws. A caller's abort stops it at once, also
 * during a wait.
 */
export function retryingFetch(fetchFn: typeof fetch, options: RetryOptions = {}): typeof fetch {
  const {
    maxAttempts = 3,
    timeoutMs = 10_000,
    baseDelayMs = 500,
    maxDelayMs = 5_000,
    budgetMs,
    isRetryable = async () => false,
    sleep = abortableSleep,
    random = Math.random,
    now = () => new Date(),
  } = options;

  // Full jitter keeps clients that failed together from retrying together.
  const backoffMs = (n: number) => random() * Math.min(maxDelayMs, baseDelayMs * 2 ** (n - 1));

  let deadline: number | undefined;
  const remainingMs = () => (deadline === undefined ? Infinity : deadline - now().getTime());

  return async (input, init) => {
    if (budgetMs !== undefined) deadline ??= now().getTime() + budgetMs;
    const callerSignal = init?.signal ?? undefined;
    const neverAborts = new AbortController().signal;

    for (let n = 1; ; n++) {
      callerSignal?.throwIfAborted();
      const remaining = remainingMs();
      if (remaining <= 0) {
        throw new DOMException("The retry budget was used up.", "TimeoutError");
      }
      const last = n >= maxAttempts;

      const timeout = timeoutSignal(Math.min(timeoutMs, remaining));
      const signal = callerSignal
        ? AbortSignal.any([callerSignal, timeout.signal])
        : timeout.signal;
      let res: Response | undefined;
      let failure: unknown;
      try {
        res = await attempt(fetchFn, input, init, signal);
      } catch (error: unknown) {
        failure = error;
      } finally {
        timeout.clear();
      }

      if (res) {
        if (res.ok || last) return res;
        if (!RETRYABLE_STATUSES.has(res.status) && !(await isRetryable(res))) return res;
      } else if (last || callerSignal?.aborted) {
        throw failure;
      }

      const retryAfter = res ? retryAfterMs(res, now()) : null;
      // The provider asked for a longer wait than we allow; retrying sooner
      // would only fail again.
      if (res && retryAfter != null && retryAfter > maxDelayMs) return res;

      const wait = retryAfter ?? backoffMs(n);
      // No time would be left for another attempt after the wait.
      if (wait >= remainingMs()) {
        if (res) return res;
        throw failure;
      }
      await sleep(wait, callerSignal ?? neverAborts);
    }
  };
}
