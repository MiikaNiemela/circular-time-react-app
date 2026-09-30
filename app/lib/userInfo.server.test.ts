import { describe, it, expect, vi } from "vitest";
import {
  fetchGoogleUserId,
  fetchOutlookUserId,
  verifyGoogleCalendarAccess,
  verifyOutlookCalendarAccess,
} from "./userInfo.server";

function jsonFetch(body: unknown, status = 200): typeof fetch {
  return vi.fn(
    async () => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response
  );
}

describe("fetchGoogleUserId", () => {
  it("returns the sub claim on success", async () => {
    const id = await fetchGoogleUserId("tok", jsonFetch({ sub: "google-user-123" }));
    expect(id).toBe("google-user-123");
  });

  it("throws when the response is not ok", async () => {
    await expect(fetchGoogleUserId("bad", jsonFetch({}, 401))).rejects.toThrow(
      "Google userinfo failed: 401"
    );
  });

  it("throws when sub is missing from the response", async () => {
    await expect(fetchGoogleUserId("tok", jsonFetch({}))).rejects.toThrow(
      "Google userinfo response missing sub claim"
    );
  });
});

describe("verifyGoogleCalendarAccess", () => {
  it("accepts a token that can list calendars", async () => {
    await expect(
      verifyGoogleCalendarAccess("calendar-token", jsonFetch({ items: [] }))
    ).resolves.toBeUndefined();
  });

  it("rejects a token without calendar-read authorization", async () => {
    await expect(verifyGoogleCalendarAccess("identity-token", jsonFetch({}, 403))).rejects.toThrow(
      "Google calendar access failed: 403"
    );
  });
});

describe("fetchOutlookUserId", () => {
  it("returns the id field on success", async () => {
    const id = await fetchOutlookUserId("tok", jsonFetch({ id: "outlook-user-abc" }));
    expect(id).toBe("outlook-user-abc");
  });

  it("throws when the response is not ok", async () => {
    await expect(fetchOutlookUserId("bad", jsonFetch({}, 401))).rejects.toThrow(
      "Outlook /me failed: 401"
    );
  });

  it("throws when id is missing from the response", async () => {
    await expect(fetchOutlookUserId("tok", jsonFetch({}))).rejects.toThrow(
      "Outlook /me response missing id field"
    );
  });
});

describe("verifyOutlookCalendarAccess", () => {
  it("accepts a token that can list calendars", async () => {
    await expect(
      verifyOutlookCalendarAccess("calendar-token", jsonFetch({ value: [] }))
    ).resolves.toBeUndefined();
  });

  it("rejects a token without calendar-read authorization", async () => {
    await expect(verifyOutlookCalendarAccess("identity-token", jsonFetch({}, 403))).rejects.toThrow(
      "Outlook calendar access failed: 403"
    );
  });
});
