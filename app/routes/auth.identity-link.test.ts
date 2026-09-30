import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserId: vi.fn(),
  fetchGoogleUserId: vi.fn(),
  fetchOutlookUserId: vi.fn(),
  linkProviderAccount: vi.fn(),
}));

vi.mock("../lib/session.server", () => ({ getUserId: mocks.getUserId }));
vi.mock("../lib/userInfo.server", () => ({
  fetchGoogleUserId: mocks.fetchGoogleUserId,
  fetchOutlookUserId: mocks.fetchOutlookUserId,
}));
vi.mock("../lib/userRepository.server", () => ({
  userRepository: { linkProviderAccount: mocks.linkProviderAccount },
}));

import { action } from "./auth.identity-link";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/auth/identity-link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function callAction(body: unknown) {
  return action({ request: makeRequest(body) } as Parameters<typeof action>[0]);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUserId.mockResolvedValue("user-uuid");
  mocks.fetchGoogleUserId.mockResolvedValue("google-sub-123");
  mocks.fetchOutlookUserId.mockResolvedValue("outlook-id-abc");
  mocks.linkProviderAccount.mockResolvedValue("linked");
});

describe("POST /auth/identity-link", () => {
  it("rejects a link without an authenticated application session", async () => {
    mocks.getUserId.mockResolvedValue(null);

    const response = await callAction({ provider: "outlook", accessToken: "token" });

    expect(response.status).toBe(401);
    expect(mocks.linkProviderAccount).not.toHaveBeenCalled();
  });

  it("links the provider-verified identity to the session's account", async () => {
    const response = await callAction({ provider: "outlook", accessToken: "token" });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.fetchOutlookUserId).toHaveBeenCalledWith("token");
    expect(mocks.linkProviderAccount).toHaveBeenCalledWith(
      "user-uuid",
      "outlook",
      "outlook-id-abc"
    );
  });

  it("does not change the application session", async () => {
    const response = await callAction({ provider: "google", accessToken: "token" });

    expect(response.headers.get("Set-Cookie")).toBeNull();
  });

  it("refuses an identity owned by another account without merging", async () => {
    mocks.linkProviderAccount.mockResolvedValue("conflict");

    const response = await callAction({ provider: "google", accessToken: "token" });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error:
        "This account already belongs to another Circular Time account. Accounts are never merged.",
    });
  });

  it("refuses a second identity from an already-linked provider", async () => {
    mocks.linkProviderAccount.mockResolvedValue("provider-already-linked");

    const response = await callAction({ provider: "google", accessToken: "token" });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "A different account from this provider is already linked.",
    });
  });

  it("rejects an identity the provider cannot verify", async () => {
    mocks.fetchGoogleUserId.mockRejectedValue(new Error("invalid token"));

    const response = await callAction({ provider: "google", accessToken: "bad-token" });

    expect(response.status).toBe(401);
    expect(mocks.linkProviderAccount).not.toHaveBeenCalled();
  });

  it("rejects an unknown provider", async () => {
    const response = await callAction({ provider: "ical", accessToken: "token" });

    expect(response.status).toBe(400);
    expect(mocks.linkProviderAccount).not.toHaveBeenCalled();
  });

  it("rejects a malformed or incomplete request body", async () => {
    await expect(callAction("not json")).resolves.toHaveProperty("status", 400);
    await expect(callAction({ provider: "google" })).resolves.toHaveProperty("status", 400);
    expect(mocks.linkProviderAccount).not.toHaveBeenCalled();
  });

  it("reports storage failures as unavailable", async () => {
    mocks.linkProviderAccount.mockRejectedValue(new Error("database down"));

    const response = await callAction({ provider: "google", accessToken: "token" });

    expect(response.status).toBe(503);
  });
});
