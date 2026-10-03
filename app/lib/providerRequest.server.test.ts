import { describe, it, expect } from "vitest";
import { readProviderBody } from "./providerRequest.server";

const request = (body: string) =>
  new Request("http://localhost/x", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

describe("readProviderBody", () => {
  it.each(["google", "outlook"])("returns %s", async (provider) => {
    expect(await readProviderBody(request(JSON.stringify({ provider })))).toBe(provider);
  });

  it.each([
    ["invalid JSON", "{not json"],
    ["null", "null"],
    ["a number", "42"],
    ["a string", JSON.stringify("google")],
    ["an array", JSON.stringify(["google"])],
    ["no provider", "{}"],
    ["an unknown provider", JSON.stringify({ provider: "apple" })],
    ["a non-string provider", JSON.stringify({ provider: 1 })],
  ])("answers %s with 400", async (_name, body) => {
    const result = await readProviderBody(request(body));
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(400);
  });
});
