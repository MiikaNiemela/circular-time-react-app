import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserId: vi.fn(),
  getSession: vi.fn(),
  commitSession: vi.fn(),
}));

vi.mock("../data/providers/google/config", () => ({ GOOGLE_CLIENT_ID: "google-client" }));
vi.mock("../data/providers/outlook/config", () => ({ OUTLOOK_CLIENT_ID: "outlook-client" }));
vi.mock("../lib/session.server", () => ({
  getUserId: mocks.getUserId,
  getSession: mocks.getSession,
  commitSession: mocks.commitSession,
}));

import { action as googleStart } from "./auth.google.start";
import { action as outlookStart } from "./auth.outlook.start";
import { ORIGIN_CASES, SAME_ORIGIN, gateRequest } from "./mutationGate.testing";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUserId.mockResolvedValue(null);
  mocks.getSession.mockResolvedValue({ set: vi.fn(), get: vi.fn() });
  mocks.commitSession.mockResolvedValue("__session=flow");
});

describe.each([
  ["google", googleStart],
  ["outlook", outlookStart],
])("POST /auth/%s/start", (provider, action) => {
  const post = (overrides: Record<string, string | null>) =>
    gateRequest(
      `http://localhost/auth/${provider}/start`,
      { Origin: SAME_ORIGIN, "Content-Type": "application/x-www-form-urlencoded" },
      overrides,
      new URLSearchParams({ intent: "sign-in" })
    );

  it("starts a same-origin sign-in by redirecting to the provider", async () => {
    // @ts-expect-error test fixture omits router-internal url and pattern fields
    const response = await action({ request: post({}), params: {}, context: {} });
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toMatch(/^https:\/\//);
    expect(response.headers.get("Set-Cookie")).toBeTruthy();
  });

  it.each(ORIGIN_CASES)("refuses $name without starting a flow", async (c) => {
    // @ts-expect-error test fixture omits router-internal url and pattern fields
    const response = await action({ request: post(c.headers), params: {}, context: {} });
    expect(response.status).toBe(c.status);
    expect(response.headers.get("Location")).toBeNull();
    expect(response.headers.get("Set-Cookie")).toBeNull();
  });
});
