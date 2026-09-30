import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  destroySession: vi.fn(),
}));

vi.mock("../lib/session.server", () => ({
  getSession: mocks.getSession,
  destroySession: mocks.destroySession,
}));

import { action } from "./auth.sign-out";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({});
  mocks.destroySession.mockResolvedValue("__session=; Max-Age=0; HttpOnly");
});

describe("POST /auth/sign-out", () => {
  it("clears the signed application session", async () => {
    const request = new Request("http://localhost/auth/sign-out", {
      method: "POST",
      headers: { Cookie: "__session=signed" },
    });

    // @ts-expect-error test fixture omits router-internal url and pattern fields
    const response = await action({ request, params: {}, context: {} });

    expect(response.status).toBe(204);
    expect(mocks.getSession).toHaveBeenCalledWith("__session=signed");
    expect(mocks.destroySession).toHaveBeenCalledWith({});
    expect(response.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });
});
