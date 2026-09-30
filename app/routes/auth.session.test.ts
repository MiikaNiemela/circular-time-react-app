import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchGoogleUserId: vi.fn(),
  fetchOutlookUserId: vi.fn(),
  signInWithProvider: vi.fn(),
  mockSession: { id: "", get: vi.fn(), set: vi.fn(), flash: vi.fn(), unset: vi.fn() },
  previousSession: { id: "", get: vi.fn(), set: vi.fn(), flash: vi.fn(), unset: vi.fn() },
  getSession: vi.fn(),
  commitSession: vi.fn(),
  destroySession: vi.fn(),
}));

vi.mock("../lib/userInfo.server", () => ({
  fetchGoogleUserId: mocks.fetchGoogleUserId,
  fetchOutlookUserId: mocks.fetchOutlookUserId,
}));

vi.mock("../lib/userRepository.server", () => ({
  userRepository: {
    signInWithProvider: mocks.signInWithProvider,
  },
}));

vi.mock("../lib/session.server", () => ({
  getSession: mocks.getSession,
  commitSession: mocks.commitSession,
  destroySession: mocks.destroySession,
}));

import { action } from "./auth.session";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.previousSession.id = "";
  // The first lookup reads the request's cookie; the second creates a fresh session.
  mocks.getSession.mockImplementation(async (cookie: string | null) =>
    cookie === null ? mocks.mockSession : mocks.previousSession
  );
  mocks.mockSession.get.mockReturnValue(undefined);
  mocks.commitSession.mockResolvedValue("__session=signed; HttpOnly");
  mocks.fetchGoogleUserId.mockResolvedValue("google-sub-123");
  mocks.fetchOutlookUserId.mockResolvedValue("outlook-id-abc");
  mocks.signInWithProvider.mockResolvedValue({ kind: "signed-in", userId: "stable-user-uuid" });
});

describe("POST /auth/session", () => {
  it("returns 400 for invalid JSON body", async () => {
    const req = new Request("http://localhost/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    // @ts-expect-error test fixture omits router-internal url and pattern fields
    const res = await action({ request: req, params: {}, context: {} });
    expect(res.status).toBe(400);
  });

  it("returns 400 when provider is missing", async () => {
    // @ts-expect-error test fixture omits router-internal url and pattern fields
    const res = await action({
      request: makeRequest({ accessToken: "tok" }),
      params: {},
      context: {},
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when accessToken is missing", async () => {
    // @ts-expect-error test fixture omits router-internal url and pattern fields
    const res = await action({
      request: makeRequest({ provider: "google" }),
      params: {},
      context: {},
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when OAuth intent is missing", async () => {
    // @ts-expect-error test fixture omits router-internal url and pattern fields
    const res = await action({
      request: makeRequest({ provider: "google", accessToken: "tok" }),
      params: {},
      context: {},
    });
    expect(res.status).toBe(400);
    expect(mocks.signInWithProvider).not.toHaveBeenCalled();
  });

  it("returns 400 for an unknown provider", async () => {
    // @ts-expect-error test fixture omits router-internal url and pattern fields
    const res = await action({
      request: makeRequest({ intent: "sign-in", provider: "apple", accessToken: "tok" }),
      params: {},
      context: {},
    });
    expect(res.status).toBe(400);
  });

  it("returns 401 when Google identity verification fails", async () => {
    mocks.fetchGoogleUserId.mockRejectedValue(new Error("Google userinfo failed: 401"));
    // @ts-expect-error test fixture omits router-internal url and pattern fields
    const res = await action({
      request: makeRequest({ intent: "sign-in", provider: "google", accessToken: "bad" }),
      params: {},
      context: {},
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 when Outlook identity verification fails", async () => {
    mocks.fetchOutlookUserId.mockRejectedValue(new Error("Outlook /me failed: 401"));
    // @ts-expect-error test fixture omits router-internal url and pattern fields
    const res = await action({
      request: makeRequest({ intent: "sign-in", provider: "outlook", accessToken: "bad" }),
      params: {},
      context: {},
    });
    expect(res.status).toBe(401);
  });

  it("returns 503 when the user repository throws", async () => {
    mocks.signInWithProvider.mockRejectedValue(new Error("DB connection lost"));
    // @ts-expect-error test fixture omits router-internal url and pattern fields
    const res = await action({
      request: makeRequest({ intent: "sign-in", provider: "google", accessToken: "tok" }),
      params: {},
      context: {},
    });
    expect(res.status).toBe(503);
  });

  it("returns 403 when an identity is only registered as a calendar connection", async () => {
    mocks.signInWithProvider.mockResolvedValue({ kind: "calendar-only" });
    // @ts-expect-error test fixture omits router-internal url and pattern fields
    const res = await action({
      request: makeRequest({
        intent: "sign-in",
        provider: "google",
        accessToken: "calendar-token",
      }),
      params: {},
      context: {},
    });

    expect(res.status).toBe(403);
    expect(mocks.signInWithProvider).toHaveBeenCalledWith("google", "google-sub-123");
    expect(mocks.mockSession.set).not.toHaveBeenCalled();
  });

  it("returns 200 with Set-Cookie and stores the stable user ID for a valid Google token", async () => {
    // @ts-expect-error test fixture omits router-internal url and pattern fields
    const res = await action({
      request: makeRequest({ intent: "sign-in", provider: "google", accessToken: "tok" }),
      params: {},
      context: {},
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Set-Cookie")).toContain("__session=signed");
    expect(mocks.signInWithProvider).toHaveBeenCalledWith("google", "google-sub-123");
    expect(mocks.mockSession.set).toHaveBeenCalledWith("userId", "stable-user-uuid");
  });

  it("returns 200 with Set-Cookie and stores the stable user ID for a valid Outlook token", async () => {
    // @ts-expect-error test fixture omits router-internal url and pattern fields
    const res = await action({
      request: makeRequest({ intent: "sign-in", provider: "outlook", accessToken: "tok" }),
      params: {},
      context: {},
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Set-Cookie")).toContain("__session=signed");
    expect(mocks.signInWithProvider).toHaveBeenCalledWith("outlook", "outlook-id-abc");
    expect(mocks.mockSession.set).toHaveBeenCalledWith("userId", "stable-user-uuid");
  });

  it("revokes an existing session and issues a new one instead of reusing it", async () => {
    mocks.previousSession.id = "earlier-session-token";
    const request = new Request("http://localhost/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: "__session=earlier" },
      body: JSON.stringify({ intent: "sign-in", provider: "google", accessToken: "tok" }),
    });

    // @ts-expect-error test fixture omits router-internal url and pattern fields
    const res = await action({ request, params: {}, context: {} });

    expect(res.status).toBe(200);
    expect(mocks.destroySession).toHaveBeenCalledWith(mocks.previousSession);
    expect(mocks.getSession).toHaveBeenLastCalledWith(null);
    expect(mocks.mockSession.set).toHaveBeenCalledWith("userId", "stable-user-uuid");
    expect(mocks.previousSession.set).not.toHaveBeenCalled();
  });

  it("does not revoke anything when the request has no session", async () => {
    // @ts-expect-error test fixture omits router-internal url and pattern fields
    await action({
      request: makeRequest({ intent: "sign-in", provider: "google", accessToken: "tok" }),
      params: {},
      context: {},
    });

    expect(mocks.destroySession).not.toHaveBeenCalled();
  });
});
