import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserId: vi.fn(),
  disconnectCalendarProvider: vi.fn(),
}));

vi.mock("../lib/session.server", () => ({ getUserId: mocks.getUserId }));
vi.mock("../lib/userRepository.server", () => ({
  userRepository: { disconnectCalendarProvider: mocks.disconnectCalendarProvider },
}));

import { action } from "./auth.calendar-disconnection";
import { JSON_CASE, ORIGIN_CASES, SAME_ORIGIN, gateRequest } from "./mutationGate.testing";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/auth/calendar-disconnection", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUserId.mockResolvedValue("user-uuid");
  mocks.disconnectCalendarProvider.mockResolvedValue(undefined);
});

describe("POST /auth/calendar-disconnection", () => {
  it("rejects a disconnection without an authenticated application session", async () => {
    mocks.getUserId.mockResolvedValue(null);

    // @ts-expect-error test fixture omits router-internal url and pattern fields
    const response = await action({
      request: makeRequest({ provider: "google" }),
      params: {},
      context: {},
    });

    expect(response.status).toBe(401);
    expect(mocks.disconnectCalendarProvider).not.toHaveBeenCalled();
  });

  it("removes calendar access and its server cache for the authenticated account", async () => {
    // @ts-expect-error test fixture omits router-internal url and pattern fields
    const response = await action({
      request: makeRequest({ provider: "outlook" }),
      params: {},
      context: {},
    });

    expect(response.status).toBe(200);
    expect(mocks.disconnectCalendarProvider).toHaveBeenCalledWith("user-uuid", "outlook");
  });

  it("rejects an unknown provider before changing stored state", async () => {
    // @ts-expect-error test fixture omits router-internal url and pattern fields
    const response = await action({
      request: makeRequest({ provider: "ical" }),
      params: {},
      context: {},
    });

    expect(response.status).toBe(400);
    expect(mocks.disconnectCalendarProvider).not.toHaveBeenCalled();
  });

  it("reports server persistence failures", async () => {
    mocks.disconnectCalendarProvider.mockRejectedValue(new Error("database unavailable"));

    // @ts-expect-error test fixture omits router-internal url and pattern fields
    const response = await action({
      request: makeRequest({ provider: "google" }),
      params: {},
      context: {},
    });

    expect(response.status).toBe(503);
  });

  it.each([...ORIGIN_CASES, JSON_CASE])("refuses $name without changing anything", async (c) => {
    const request = gateRequest(
      "http://localhost/auth/calendar-disconnection",
      { "Content-Type": "application/json", Origin: SAME_ORIGIN },
      c.headers,
      JSON.stringify({ provider: "google" })
    );
    // @ts-expect-error test fixture omits router-internal url and pattern fields
    const response = await action({ request, params: {}, context: {} });
    expect(response.status).toBe(c.status);
    expect(mocks.disconnectCalendarProvider).not.toHaveBeenCalled();
  });
});
