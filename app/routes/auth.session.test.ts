import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchGoogleUserId: vi.fn(),
  fetchOutlookUserId: vi.fn(),
  signInWithProvider: vi.fn(),
  mockSession: { get: vi.fn(), set: vi.fn(), flash: vi.fn(), unset: vi.fn() },
  getSession: vi.fn(),
  commitSession: vi.fn(),
}));

vi.mock("../lib/userInfo.server", () => ({
  fetchGoogleUserId: mocks.fetchGoogleUserId,
  fetchOutlookUserId: mocks.fetchOutlookUserId,
}));

vi.mock("../lib/userRepository.server", () => ({
  userRepository: { signInWithProvider: mocks.signInWithProvider },
}));

vi.mock("react-router", () => ({
  createCookieSessionStorage: vi.fn(() => ({
    getSession: mocks.getSession,
    commitSession: mocks.commitSession,
    destroySession: vi.fn(),
  })),
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
  mocks.getSession.mockResolvedValue(mocks.mockSession);
  mocks.commitSession.mockResolvedValue("__session=signed; HttpOnly");
  mocks.fetchGoogleUserId.mockResolvedValue("google-sub-123");
  mocks.fetchOutlookUserId.mockResolvedValue("outlook-id-abc");
  mocks.signInWithProvider.mockResolvedValue("stable-user-uuid");
});

describe("POST /auth/session", () => {
  it("returns 400 for invalid JSON body", async () => {
    const req = new Request("http://localhost/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    // @ts-expect-error action arg shape differs from Route.ActionArgs in tests
    const res = await action({ request: req, params: {}, context: {} });
    expect(res.status).toBe(400);
  });

  it("returns 400 when provider is missing", async () => {
    // @ts-expect-error action arg shape differs from Route.ActionArgs in tests
    const res = await action({
      request: makeRequest({ accessToken: "tok" }),
      params: {},
      context: {},
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when accessToken is missing", async () => {
    // @ts-expect-error action arg shape differs from Route.ActionArgs in tests
    const res = await action({
      request: makeRequest({ provider: "google" }),
      params: {},
      context: {},
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when OAuth intent is missing", async () => {
    // @ts-expect-error action arg shape differs from Route.ActionArgs in tests
    const res = await action({
      request: makeRequest({ provider: "google", accessToken: "tok" }),
      params: {},
      context: {},
    });
    expect(res.status).toBe(400);
    expect(mocks.signInWithProvider).not.toHaveBeenCalled();
  });

  it("returns 400 for an unknown provider", async () => {
    // @ts-expect-error action arg shape differs from Route.ActionArgs in tests
    const res = await action({
      request: makeRequest({ intent: "sign-in", provider: "apple", accessToken: "tok" }),
      params: {},
      context: {},
    });
    expect(res.status).toBe(400);
  });

  it("returns 401 when Google identity verification fails", async () => {
    mocks.fetchGoogleUserId.mockRejectedValue(new Error("Google userinfo failed: 401"));
    // @ts-expect-error action arg shape differs from Route.ActionArgs in tests
    const res = await action({
      request: makeRequest({ intent: "sign-in", provider: "google", accessToken: "bad" }),
      params: {},
      context: {},
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 when Outlook identity verification fails", async () => {
    mocks.fetchOutlookUserId.mockRejectedValue(new Error("Outlook /me failed: 401"));
    // @ts-expect-error action arg shape differs from Route.ActionArgs in tests
    const res = await action({
      request: makeRequest({ intent: "sign-in", provider: "outlook", accessToken: "bad" }),
      params: {},
      context: {},
    });
    expect(res.status).toBe(401);
  });

  it("returns 503 when the user repository throws", async () => {
    mocks.signInWithProvider.mockRejectedValue(new Error("DB connection lost"));
    // @ts-expect-error action arg shape differs from Route.ActionArgs in tests
    const res = await action({
      request: makeRequest({ intent: "sign-in", provider: "google", accessToken: "tok" }),
      params: {},
      context: {},
    });
    expect(res.status).toBe(503);
  });

  it("returns 200 with Set-Cookie and stores the stable user ID for a valid Google token", async () => {
    // @ts-expect-error action arg shape differs from Route.ActionArgs in tests
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
    // @ts-expect-error action arg shape differs from Route.ActionArgs in tests
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
});
