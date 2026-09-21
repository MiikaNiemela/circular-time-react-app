import { describe, it, expect, vi } from "vitest";
import { proxyGoogleToken } from "./tokenProxy";

function params(obj: Record<string, string>): URLSearchParams {
  return new URLSearchParams(obj);
}

function textResponse(body: string, status = 200): Response {
  return { status, text: async () => body } as Response;
}

const ENV = { clientId: "cid", clientSecret: "secret" };

describe("proxyGoogleToken", () => {
  it("returns 500 when the server is not configured", async () => {
    const res = await proxyGoogleToken(params({ grant_type: "authorization_code", code: "x" }), {
      clientId: "",
      clientSecret: "",
    });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("server_not_configured");
  });

  it("injects the server credentials and forwards to Google", async () => {
    const fetchFn = vi.fn(async (_url: string, _init?: RequestInit) =>
      textResponse(JSON.stringify({ access_token: "at", expires_in: 3600 }), 200)
    );

    const res = await proxyGoogleToken(
      params({
        grant_type: "authorization_code",
        code: "the-code",
        code_verifier: "the-verifier",
        redirect_uri: "https://app/cb",
      }),
      ENV,
      fetchFn as unknown as typeof fetch
    );

    expect(res.status).toBe(200);
    expect((await res.json()).access_token).toBe("at");

    const [url, init] = fetchFn.mock.calls[0];
    expect(String(url)).toBe("https://oauth2.googleapis.com/token");
    const body = (init as RequestInit).body as string;
    expect(body).toContain("code_verifier=the-verifier");
    expect(body).toContain("client_id=cid");
    expect(body).toContain("client_secret=secret");
  });

  it("ignores client-supplied client_id / client_secret (no override)", async () => {
    const fetchFn = vi.fn(async (_url: string, _init?: RequestInit) => textResponse("{}", 200));

    await proxyGoogleToken(
      params({
        grant_type: "authorization_code",
        code: "c",
        client_id: "attacker",
        client_secret: "attacker-secret",
      }),
      ENV,
      fetchFn as unknown as typeof fetch
    );

    const body = (fetchFn.mock.calls[0][1] as RequestInit).body as string;
    expect(body).toContain("client_id=cid");
    expect(body).toContain("client_secret=secret");
    expect(body).not.toContain("attacker");
  });

  it("passes through Google's error status and body verbatim", async () => {
    const fetchFn = vi.fn(async () =>
      textResponse(JSON.stringify({ error: "invalid_grant" }), 400)
    );

    const res = await proxyGoogleToken(
      params({ grant_type: "refresh_token", refresh_token: "rt" }),
      ENV,
      fetchFn as unknown as typeof fetch
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_grant");
  });
});
