import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  session: { get: vi.fn(), set: vi.fn(), flash: vi.fn(), unset: vi.fn() },
  getSession: vi.fn(),
  commitSession: vi.fn(),
}));

vi.mock("react-router", () => ({
  createCookieSessionStorage: vi.fn(() => ({
    getSession: mocks.getSession,
    commitSession: mocks.commitSession,
    destroySession: vi.fn(),
  })),
}));

import { getUserId } from "./session.server";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue(mocks.session);
});

describe("getUserId", () => {
  it("returns null when no userId is in the session", async () => {
    mocks.session.get.mockReturnValue(undefined);
    const req = new Request("http://localhost/");
    expect(await getUserId(req)).toBeNull();
  });

  it("returns the userId stored in the session", async () => {
    mocks.session.get.mockReturnValue("google:116123");
    const req = new Request("http://localhost/");
    expect(await getUserId(req)).toBe("google:116123");
  });

  it("passes the Cookie header to getSession", async () => {
    mocks.session.get.mockReturnValue(null);
    const req = new Request("http://localhost/", {
      headers: { Cookie: "__session=abc" },
    });
    await getUserId(req);
    expect(mocks.getSession).toHaveBeenCalledWith("__session=abc");
  });
});
