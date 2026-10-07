import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserId: vi.fn(),
  applyStreamChange: vi.fn(),
}));

vi.mock("../lib/session.server", () => ({ getUserId: mocks.getUserId }));
vi.mock("../lib/streamRepository.server", () => ({
  streamRepository: { applyStreamChange: mocks.applyStreamChange },
}));

import { action } from "./streams";
import { JSON_CASE, ORIGIN_CASES, SAME_ORIGIN, gateRequest } from "./mutationGate.testing";

const DEFAULTS = { "Content-Type": "application/json", Origin: SAME_ORIGIN };

function post(body: unknown, overrides: Record<string, string | null> = {}, raw?: string) {
  const request = gateRequest(
    "http://localhost/streams",
    DEFAULTS,
    overrides,
    raw ?? JSON.stringify(body)
  );
  // @ts-expect-error test fixture omits router-internal url and pattern fields
  return action({ request, params: {}, context: {} });
}

const RENAME = { intent: "rename", streamId: "s1", name: "Work" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUserId.mockResolvedValue("user-1");
  mocks.applyStreamChange.mockResolvedValue("ok");
});

describe("POST /streams", () => {
  it("applies a valid change for the signed-in account", async () => {
    const response = await post(RENAME);
    expect(response.status).toBe(200);
    expect(mocks.applyStreamChange).toHaveBeenCalledWith("user-1", RENAME);
  });

  it("requires a session", async () => {
    mocks.getUserId.mockResolvedValue(null);
    expect((await post(RENAME)).status).toBe(401);
    expect(mocks.applyStreamChange).not.toHaveBeenCalled();
  });

  it.each([...ORIGIN_CASES, JSON_CASE])("refuses $name without changing anything", async (c) => {
    expect((await post(RENAME, c.headers)).status).toBe(c.status);
    expect(mocks.applyStreamChange).not.toHaveBeenCalled();
  });

  it.each([
    ["invalid JSON", "{nope"],
    ["null", "null"],
    ["an unknown intent", JSON.stringify({ intent: "explode", streamId: "s1" })],
    ["a blank name", JSON.stringify({ intent: "rename", streamId: "s1", name: " " })],
  ])("rejects %s with 400", async (_name, raw) => {
    expect((await post(null, {}, raw)).status).toBe(400);
    expect(mocks.applyStreamChange).not.toHaveBeenCalled();
  });

  it.each([
    ["not-found", 404],
    ["not-empty", 409],
  ])("maps %s to %i", async (result, status) => {
    mocks.applyStreamChange.mockResolvedValue(result);
    expect((await post(RENAME)).status).toBe(status);
  });

  it("returns 503 when the store fails", async () => {
    mocks.applyStreamChange.mockRejectedValue(new Error("db down"));
    expect((await post(RENAME)).status).toBe(503);
  });
});
