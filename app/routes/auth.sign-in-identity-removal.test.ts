import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserId: vi.fn(),
  removeSignInIdentity: vi.fn(),
}));

vi.mock("../lib/session.server", () => ({ getUserId: mocks.getUserId }));
vi.mock("../lib/userRepository.server", () => ({
  userRepository: { removeSignInIdentity: mocks.removeSignInIdentity },
}));

import { action } from "./auth.sign-in-identity-removal";

function post(body: unknown, raw?: string) {
  // @ts-expect-error test fixture omits router-internal url and pattern fields
  return action({
    request: new Request("http://localhost/auth/sign-in-identity-removal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: raw ?? JSON.stringify(body),
    }),
    params: {},
    context: {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUserId.mockResolvedValue("user-uuid");
  mocks.removeSignInIdentity.mockResolvedValue("removed");
});

describe("POST /auth/sign-in-identity-removal", () => {
  it("rejects a request without an application session", async () => {
    mocks.getUserId.mockResolvedValue(null);
    const response = await post({ provider: "outlook" });
    expect(response.status).toBe(401);
    expect(mocks.removeSignInIdentity).not.toHaveBeenCalled();
  });

  it("rejects a malformed body and an unknown provider", async () => {
    expect((await post(null, "{not json")).status).toBe(400);
    expect((await post(null, "null")).status).toBe(400);
    expect((await post(null, "[]")).status).toBe(400);
    expect((await post({ provider: "apple" })).status).toBe(400);
    expect(mocks.removeSignInIdentity).not.toHaveBeenCalled();
  });

  it("removes the signed-in user's identity for the provider", async () => {
    const response = await post({ provider: "outlook" });
    expect(response.status).toBe(200);
    expect(mocks.removeSignInIdentity).toHaveBeenCalledWith("user-uuid", "outlook");
  });

  it("refuses the last sign-in identity with 409", async () => {
    mocks.removeSignInIdentity.mockResolvedValue("last-identity");
    expect((await post({ provider: "google" })).status).toBe(409);
  });

  it("reports an identity that is not linked with 404", async () => {
    mocks.removeSignInIdentity.mockResolvedValue("not-linked");
    expect((await post({ provider: "outlook" })).status).toBe(404);
  });

  it("returns 503 when the store fails", async () => {
    mocks.removeSignInIdentity.mockRejectedValue(new Error("db down"));
    expect((await post({ provider: "outlook" })).status).toBe(503);
  });
});
