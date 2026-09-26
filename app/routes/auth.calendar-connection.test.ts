import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserId: vi.fn(),
  fetchGoogleUserId: vi.fn(),
  fetchOutlookUserId: vi.fn(),
  connectCalendarProvider: vi.fn(),
}));

vi.mock("../lib/session.server", () => ({ getUserId: mocks.getUserId }));
vi.mock("../lib/userInfo.server", () => ({
  fetchGoogleUserId: mocks.fetchGoogleUserId,
  fetchOutlookUserId: mocks.fetchOutlookUserId,
}));
vi.mock("../lib/userRepository.server", () => ({
  userRepository: { connectCalendarProvider: mocks.connectCalendarProvider },
}));

import { action } from "./auth.calendar-connection";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/auth/calendar-connection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUserId.mockResolvedValue("user-uuid");
  mocks.fetchGoogleUserId.mockResolvedValue("google-sub-123");
  mocks.fetchOutlookUserId.mockResolvedValue("outlook-id-abc");
  mocks.connectCalendarProvider.mockResolvedValue("connected");
});

describe("POST /auth/calendar-connection", () => {
  it("rejects a calendar connection without an authenticated application session", async () => {
    mocks.getUserId.mockResolvedValue(null);

    // @ts-expect-error test fixture omits router-internal url and pattern fields
    const response = await action({
      request: makeRequest({ provider: "google", accessToken: "access-token" }),
      params: {},
      context: {},
    });

    expect(response.status).toBe(401);
    expect(mocks.fetchGoogleUserId).not.toHaveBeenCalled();
    expect(mocks.connectCalendarProvider).not.toHaveBeenCalled();
  });

  it("connects a verified Google identity to the authenticated application account", async () => {
    // @ts-expect-error test fixture omits router-internal url and pattern fields
    const response = await action({
      request: makeRequest({ provider: "google", accessToken: "access-token" }),
      params: {},
      context: {},
    });

    expect(response.status).toBe(200);
    expect(mocks.fetchGoogleUserId).toHaveBeenCalledWith("access-token");
    expect(mocks.connectCalendarProvider).toHaveBeenCalledWith(
      "user-uuid",
      "google",
      "google-sub-123"
    );
  });

  it("connects a verified Outlook identity to the authenticated application account", async () => {
    // @ts-expect-error test fixture omits router-internal url and pattern fields
    const response = await action({
      request: makeRequest({ provider: "outlook", accessToken: "access-token" }),
      params: {},
      context: {},
    });

    expect(response.status).toBe(200);
    expect(mocks.fetchOutlookUserId).toHaveBeenCalledWith("access-token");
    expect(mocks.connectCalendarProvider).toHaveBeenCalledWith(
      "user-uuid",
      "outlook",
      "outlook-id-abc"
    );
  });

  it("rejects unknown providers before calling an identity endpoint", async () => {
    // @ts-expect-error test fixture omits router-internal url and pattern fields
    const response = await action({
      request: makeRequest({ provider: "ical", accessToken: "access-token" }),
      params: {},
      context: {},
    });

    expect(response.status).toBe(400);
    expect(mocks.fetchGoogleUserId).not.toHaveBeenCalled();
    expect(mocks.fetchOutlookUserId).not.toHaveBeenCalled();
  });

  it("rejects a provider access token whose identity cannot be verified", async () => {
    mocks.fetchGoogleUserId.mockRejectedValue(new Error("Google userinfo failed: 401"));

    // @ts-expect-error test fixture omits router-internal url and pattern fields
    const response = await action({
      request: makeRequest({ provider: "google", accessToken: "invalid-token" }),
      params: {},
      context: {},
    });

    expect(response.status).toBe(401);
    expect(mocks.connectCalendarProvider).not.toHaveBeenCalled();
  });

  it("reports a conflict without merging accounts", async () => {
    mocks.connectCalendarProvider.mockResolvedValue("conflict");

    // @ts-expect-error test fixture omits router-internal url and pattern fields
    const response = await action({
      request: makeRequest({ provider: "google", accessToken: "access-token" }),
      params: {},
      context: {},
    });

    expect(response.status).toBe(409);
  });

  it("returns 503 when the connection cannot be persisted", async () => {
    mocks.connectCalendarProvider.mockRejectedValue(new Error("database unavailable"));

    // @ts-expect-error test fixture omits router-internal url and pattern fields
    const response = await action({
      request: makeRequest({ provider: "google", accessToken: "access-token" }),
      params: {},
      context: {},
    });

    expect(response.status).toBe(503);
  });
});
