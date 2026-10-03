import { describe, it, expect, vi } from "vitest";
import { INTERACTIVE_RETRY, retryingFetch, type RetryOptions } from "./retryingFetch";

const ENDPOINT = "https://provider.example/events";

function response(status: number, headers: Record<string, string> = {}): Response {
  return new Response("{}", { status, headers });
}

/** A fetch that answers with each status in turn, then repeats the last. */
function fetchReturning(...statuses: number[]) {
  let call = 0;
  return vi.fn(async (_url: string, _init?: RequestInit) =>
    response(statuses[Math.min(call++, statuses.length - 1)])
  );
}

function wrap(fetchFn: unknown, options: RetryOptions = {}) {
  const sleep = vi.fn(async (_ms: number, _signal: AbortSignal) => {});
  // random() of 1 makes every backoff its upper bound.
  const wrapped = retryingFetch(fetchFn as typeof fetch, { sleep, random: () => 1, ...options });
  return { wrapped, sleep };
}

describe("retryingFetch", () => {
  it("returns a successful response without retrying", async () => {
    const fetchFn = fetchReturning(200);
    const { wrapped, sleep } = wrap(fetchFn);

    const res = await wrapped(ENDPOINT, { headers: { Authorization: "Bearer at" } });

    expect(res.status).toBe(200);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(fetchFn.mock.calls[0][1]?.headers).toEqual({ Authorization: "Bearer at" });
  });

  it.each([408, 429, 500, 502, 503, 504])(
    "retries a %i and returns the recovery",
    async (status) => {
      const fetchFn = fetchReturning(status, 200);
      const { wrapped, sleep } = wrap(fetchFn);

      const res = await wrapped(ENDPOINT);

      expect(res.status).toBe(200);
      expect(fetchFn).toHaveBeenCalledTimes(2);
      expect(sleep).toHaveBeenCalledTimes(1);
    }
  );

  it.each([400, 401, 403, 404])("does not retry a %i", async (status) => {
    const fetchFn = fetchReturning(status);
    const { wrapped, sleep } = wrap(fetchFn);

    const res = await wrapped(ENDPOINT);

    expect(res.status).toBe(status);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("returns the failing response once the attempts are used up", async () => {
    const fetchFn = fetchReturning(503);
    const { wrapped, sleep } = wrap(fetchFn);

    const res = await wrapped(ENDPOINT);

    expect(res.status).toBe(503);
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("doubles the backoff on each retry up to the maximum delay", async () => {
    const fetchFn = fetchReturning(503);
    const { wrapped, sleep } = wrap(fetchFn, { maxAttempts: 5, baseDelayMs: 100, maxDelayMs: 300 });

    await wrapped(ENDPOINT);

    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([100, 200, 300, 300]);
  });

  it("scales the backoff by the jitter", async () => {
    const fetchFn = fetchReturning(503, 200);
    const { wrapped, sleep } = wrap(fetchFn, { baseDelayMs: 100, random: () => 0.25 });

    await wrapped(ENDPOINT);

    expect(sleep).toHaveBeenCalledWith(25, expect.anything());
  });

  it("waits for Retry-After given in seconds", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(response(429, { "Retry-After": "2" }))
      .mockResolvedValueOnce(response(200));
    const { wrapped, sleep } = wrap(fetchFn);

    const res = await wrapped(ENDPOINT);

    expect(res.status).toBe(200);
    expect(sleep).toHaveBeenCalledWith(2000, expect.anything());
  });

  it("waits for Retry-After given as a date", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(response(503, { "Retry-After": "Fri, 19 Jun 2026 09:00:03 GMT" }))
      .mockResolvedValueOnce(response(200));
    const { wrapped, sleep } = wrap(fetchFn, { now: () => new Date("2026-06-19T09:00:00Z") });

    await wrapped(ENDPOINT);

    expect(sleep).toHaveBeenCalledWith(3000, expect.anything());
  });

  it("falls back to the backoff when Retry-After is unreadable", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(response(429, { "Retry-After": "soon" }))
      .mockResolvedValueOnce(response(200));
    const { wrapped, sleep } = wrap(fetchFn, { baseDelayMs: 100 });

    await wrapped(ENDPOINT);

    expect(sleep).toHaveBeenCalledWith(100, expect.anything());
  });

  it("gives up when Retry-After is longer than the maximum delay", async () => {
    const fetchFn = vi.fn(async () => response(429, { "Retry-After": "60" }));
    const { wrapped, sleep } = wrap(fetchFn, { maxDelayMs: 5000 });

    const res = await wrapped(ENDPOINT);

    expect(res.status).toBe(429);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("retries a response the caller marks as retryable", async () => {
    const fetchFn = fetchReturning(403, 200);
    const isRetryable = vi.fn(async (res: Response) => res.status === 403);
    const { wrapped } = wrap(fetchFn, { isRetryable });

    const res = await wrapped(ENDPOINT);

    expect(res.status).toBe(200);
    expect(isRetryable).toHaveBeenCalledTimes(1);
  });

  it("retries a network failure", async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(response(200));
    const { wrapped, sleep } = wrap(fetchFn);

    const res = await wrapped(ENDPOINT);

    expect(res.status).toBe(200);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("throws the network failure once the attempts are used up", async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const { wrapped } = wrap(fetchFn);

    await expect(wrapped(ENDPOINT)).rejects.toThrow("fetch failed");
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("times out an attempt that hangs and retries it", async () => {
    const hangUntilAborted = (_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      });
    const fetchFn = vi
      .fn()
      .mockImplementationOnce(hangUntilAborted)
      .mockResolvedValueOnce(response(200));
    const { wrapped } = wrap(fetchFn, { timeoutMs: 5 });

    const res = await wrapped(ENDPOINT);

    expect(res.status).toBe(200);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("does not retry a request the caller aborted", async () => {
    const controller = new AbortController();
    const fetchFn = vi.fn(async (_url: string, init?: RequestInit) => {
      controller.abort();
      throw init?.signal?.reason;
    });
    const { wrapped, sleep } = wrap(fetchFn);

    await expect(wrapped(ENDPOINT, { signal: controller.signal })).rejects.toThrow();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("stops when the caller aborts during the wait before a retry", async () => {
    const controller = new AbortController();
    const fetchFn = fetchReturning(503, 200);
    const wrapped = retryingFetch(fetchFn as unknown as typeof fetch, { baseDelayMs: 1_000 });

    const read = wrapped(ENDPOINT, { signal: controller.signal });
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
    controller.abort();

    await expect(read).rejects.toThrow();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("retries a response whose body stalls past the attempt timeout", async () => {
    const stalledBody = (_url: string, init?: RequestInit) =>
      Promise.resolve(
        new Response(
          new ReadableStream({
            start(controller) {
              init?.signal?.addEventListener("abort", () => controller.error(init.signal?.reason));
            },
          }),
          { status: 200 }
        )
      );
    const fetchFn = vi
      .fn()
      .mockImplementationOnce(stalledBody)
      .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));
    const { wrapped } = wrap(fetchFn, { timeoutMs: 5 });

    const res = await wrapped(ENDPOINT);

    expect(await res.json()).toEqual({ ok: true });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("shares one budget across every request and stops when it is used up", async () => {
    let clock = 0;
    const now = () => new Date(clock);
    const fetchFn = vi.fn(async () => {
      clock += 600;
      return response(503);
    });
    const sleep = vi.fn(async (ms: number) => {
      clock += ms;
    });
    const wrapped = retryingFetch(fetchFn as unknown as typeof fetch, {
      maxAttempts: 10,
      baseDelayMs: 100,
      maxDelayMs: 100,
      budgetMs: 1_000,
      random: () => 1,
      sleep,
      now,
    });

    const first = await wrapped(ENDPOINT);
    // Two attempts and one wait fit; a second wait would end past the budget.
    expect(first.status).toBe(503);
    expect(fetchFn).toHaveBeenCalledTimes(2);

    await expect(wrapped(ENDPOINT)).rejects.toThrow("budget");
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("ends an interactive read against a hanging provider within its budget", async () => {
    vi.useFakeTimers();
    try {
      const hang = (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        });
      const fetchFn = vi.fn(hang);
      const wrapped = retryingFetch(fetchFn as unknown as typeof fetch, INTERACTIVE_RETRY);
      const started = Date.now();

      const read = wrapped(ENDPOINT).then(
        () => "resolved",
        () => "rejected"
      );
      await vi.runAllTimersAsync();

      expect(await read).toBe("rejected");
      expect(Date.now() - started).toBeLessThanOrEqual(INTERACTIVE_RETRY.budgetMs!);
      expect(fetchFn).toHaveBeenCalledTimes(INTERACTIVE_RETRY.maxAttempts!);
    } finally {
      vi.useRealTimers();
    }
  });
});
