import { describe, it, expect } from "vitest";
import { isSameOriginRequest, rejectUnsafeRequest } from "./sameOrigin.server";

const req = (headers: Record<string, string>) =>
  new Request("http://dev.example.com/auth/x", { method: "POST", headers });

describe("isSameOriginRequest", () => {
  it.each([
    ["the same origin", { Origin: "https://dev.example.com" }, true],
    ["the same host over http", { Origin: "http://dev.example.com" }, true],
    ["another origin", { Origin: "https://evil.example.com" }, false],
    ["a sibling subdomain", { Origin: "https://api.dev.example.com" }, false],
    ["Origin: null", { Origin: "null" }, false],
    ["a malformed Origin", { Origin: "::::" }, false],
    ["an Origin with a path", { Origin: "https://dev.example.com/path" }, false],
    ["an Origin with credentials", { Origin: "https://user:pw@dev.example.com" }, false],
    ["an Origin with a trailing slash", { Origin: "https://dev.example.com/" }, false],
    ["a non-HTTP Origin", { Origin: "ftp://dev.example.com" }, false],
    ["a Referer with credentials", { Referer: "https://user:pw@dev.example.com/x" }, false],
    ["a non-HTTP Referer", { Referer: "ftp://dev.example.com/x" }, false],
    ["no Origin, same-origin Referer", { Referer: "https://dev.example.com/settings" }, true],
    ["no Origin, foreign Referer", { Referer: "https://evil.example.com/" }, false],
    [
      "Origin wins over Referer",
      { Origin: "https://evil.example.com", Referer: "https://dev.example.com/" },
      false,
    ],
    ["no Origin and no Referer", {}, false],
  ])("%s", (_name, headers, expected) => {
    expect(isSameOriginRequest(req(headers))).toBe(expected);
  });
});

describe("rejectUnsafeRequest", () => {
  const same = { Origin: "https://dev.example.com" };

  it("lets a same-origin JSON request through", () => {
    expect(
      rejectUnsafeRequest(req({ ...same, "Content-Type": "application/json; charset=utf-8" }), {
        json: true,
      })
    ).toBeNull();
  });

  it("refuses a cross-origin request with 403", () => {
    const res = rejectUnsafeRequest(
      req({ Origin: "https://evil.example.com", "Content-Type": "application/json" }),
      {
        json: true,
      }
    );
    expect(res?.status).toBe(403);
  });

  it.each(["text/plain", "application/x-www-form-urlencoded", ""])(
    "refuses a JSON route sent as %j with 415",
    (type) => {
      const headers: Record<string, string> = { ...same };
      if (type) headers["Content-Type"] = type;
      expect(rejectUnsafeRequest(req(headers), { json: true })?.status).toBe(415);
    }
  );

  it("does not require JSON for a form route", () => {
    expect(
      rejectUnsafeRequest(req({ ...same, "Content-Type": "application/x-www-form-urlencoded" }), {
        json: false,
      })
    ).toBeNull();
  });
});
