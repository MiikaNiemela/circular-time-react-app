import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserId: vi.fn(),
  getSession: vi.fn(),
  commitSession: vi.fn(),
  destroySession: vi.fn(),
  signInWithProvider: vi.fn(),
  linkProviderAccount: vi.fn(),
  connectCalendarProvider: vi.fn(),
  fetchGoogleUserId: vi.fn(),
  fetchOutlookUserId: vi.fn(),
  verifyGoogleCalendarAccess: vi.fn(),
  verifyOutlookCalendarAccess: vi.fn(),
  exchangeAuthorizationCode: vi.fn(),
  getGoogleClientSecret: vi.fn(),
  getOutlookClientSecret: vi.fn(),
  sealCredential: vi.fn(),
  newSession: { id: "", set: vi.fn() },
  previousSession: { id: "" },
}));

vi.mock("../data/providers/google/config", () => ({ GOOGLE_CLIENT_ID: "google-client" }));
vi.mock("../data/providers/outlook/config", () => ({ OUTLOOK_CLIENT_ID: "outlook-client" }));
vi.mock("./session.server", () => ({
  getUserId: mocks.getUserId,
  getSession: mocks.getSession,
  commitSession: mocks.commitSession,
  destroySession: mocks.destroySession,
}));
vi.mock("./userRepository.server", () => ({
  userRepository: {
    signInWithProvider: mocks.signInWithProvider,
    linkProviderAccount: mocks.linkProviderAccount,
    connectCalendarProvider: mocks.connectCalendarProvider,
  },
}));
vi.mock("./userInfo.server", () => ({
  fetchGoogleUserId: mocks.fetchGoogleUserId,
  fetchOutlookUserId: mocks.fetchOutlookUserId,
  verifyGoogleCalendarAccess: mocks.verifyGoogleCalendarAccess,
  verifyOutlookCalendarAccess: mocks.verifyOutlookCalendarAccess,
}));
vi.mock("../data/providers/oauthClient.server", () => ({
  exchangeAuthorizationCode: mocks.exchangeAuthorizationCode,
}));
vi.mock("../data/providers/clientSecrets.server", () => ({
  getGoogleClientSecret: mocks.getGoogleClientSecret,
  getOutlookClientSecret: mocks.getOutlookClientSecret,
}));
vi.mock("./calendarCredentials.server", () => ({
  calendarCredentialStore: { seal: mocks.sealCredential },
}));

import { completeOAuthFlow, publicOrigin, startOAuthFlow } from "./oauthFlow.server";

type Outcome = Awaited<ReturnType<typeof completeOAuthFlow>>;

/** The failure message, or null for a redirect. */
function failure(result: Outcome): string | null {
  return result instanceof Response ? null : result.data.error;
}

/** Headers of either outcome. */
function headersOf(result: Outcome): Headers {
  return result instanceof Response ? result.headers : new Headers(result.init?.headers);
}

/** Whether the outcome expires the OAuth flow cookie. */
function expiresFlowCookie(result: Outcome): boolean {
  return /__oauth_flow=; .*Max-Age=0/.test(headersOf(result).get("Set-Cookie") ?? "");
}

const ORIGIN = "http://localhost:5173";
const TOKENS = { accessToken: "provider-at", refreshToken: "provider-rt", expiresAt: 1 };

function startRequest(provider: string, intent: string, headers: Record<string, string> = {}) {
  return new Request(`${ORIGIN}/auth/${provider}/start`, {
    method: "POST",
    headers: { Origin: ORIGIN, "Content-Type": "application/x-www-form-urlencoded", ...headers },
    body: new URLSearchParams({ intent }).toString(),
  });
}

/** Starts a flow and returns the provider URL plus the flow cookie. */
async function start(provider: "google" | "outlook", intent: string) {
  const response = await startOAuthFlow(startRequest(provider, intent), provider);
  expect(response.status).toBe(302);
  const location = new URL(response.headers.get("Location")!);
  const cookie = response.headers.get("Set-Cookie")!.split(";")[0];
  return { location, cookie, state: location.searchParams.get("state")! };
}

function callback(provider: string, query: Record<string, string>, cookie?: string) {
  return new Request(`${ORIGIN}/auth/${provider}/callback?${new URLSearchParams(query)}`, {
    headers: cookie ? { Cookie: `${cookie}; __session=signed` } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUserId.mockResolvedValue(null);
  mocks.getSession.mockImplementation(async (cookie: string | null) =>
    cookie === null ? mocks.newSession : mocks.previousSession
  );
  mocks.commitSession.mockResolvedValue("__session=new; HttpOnly");
  mocks.exchangeAuthorizationCode.mockResolvedValue(TOKENS);
  mocks.getGoogleClientSecret.mockResolvedValue("google-secret");
  mocks.getOutlookClientSecret.mockResolvedValue("outlook-secret");
  mocks.fetchGoogleUserId.mockResolvedValue("google-sub");
  mocks.fetchOutlookUserId.mockResolvedValue("outlook-id");
  mocks.signInWithProvider.mockResolvedValue({ kind: "signed-in", userId: "user-1" });
  mocks.linkProviderAccount.mockResolvedValue("linked");
  mocks.connectCalendarProvider.mockResolvedValue("connected");
  mocks.sealCredential.mockReturnValue("sealed");
  mocks.verifyGoogleCalendarAccess.mockResolvedValue(undefined);
  mocks.verifyOutlookCalendarAccess.mockResolvedValue(undefined);
});

describe("startOAuthFlow", () => {
  it("redirects to the provider with an S256 challenge and keeps the verifier in the flow cookie", async () => {
    const response = await startOAuthFlow(startRequest("google", "sign-in"), "google");

    const location = new URL(response.headers.get("Location")!);
    expect(location.origin + location.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth"
    );
    expect(location.searchParams.get("client_id")).toBe("google-client");
    expect(location.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/auth/google/callback`);
    expect(location.searchParams.get("code_challenge_method")).toBe("S256");
    expect(location.searchParams.get("scope")).toBe("openid email profile");
    const cookie = response.headers.get("Set-Cookie")!;
    expect(cookie).toMatch(/^__oauth_flow=/);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Path=/auth");
    expect(cookie).toContain("Max-Age=600");
    // The verifier is signed into the cookie, never placed in the provider URL.
    expect(location.search).not.toContain("code_verifier");
  });

  it("requests calendar scope only for a calendar connection", async () => {
    mocks.getUserId.mockResolvedValue("user-1");

    const { location } = await start("outlook", "connect-calendar");

    expect(location.searchParams.get("scope")).toContain("Calendars.Read");
    expect(location.searchParams.get("scope")).toContain("offline_access");
  });

  it("sends a signed-out user to sign-in before a link or connect flow", async () => {
    await expect(
      startOAuthFlow(startRequest("google", "connect-calendar"), "google")
    ).rejects.toMatchObject({ status: 302, headers: expect.any(Headers) });
  });

  it("refuses a cross-origin form post", async () => {
    const response = await startOAuthFlow(
      startRequest("google", "sign-in", { Origin: "https://evil.example" }),
      "google"
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("Set-Cookie")).toBeNull();
  });

  it("rejects an unknown intent", async () => {
    const response = await startOAuthFlow(startRequest("google", "delete-account"), "google");

    expect(response.status).toBe(400);
  });
});

describe("completeOAuthFlow", () => {
  it("signs in with a new session after a server-side code exchange", async () => {
    const { cookie, state } = await start("google", "sign-in");

    const result = await completeOAuthFlow(
      callback("google", { code: "code", state }, cookie),
      "google"
    );

    expect(mocks.exchangeAuthorizationCode).toHaveBeenCalledWith(
      "google",
      {
        code: "code",
        codeVerifier: expect.stringMatching(/^[\w-]{43,128}$/),
        redirectUri: `${ORIGIN}/auth/google/callback`,
      },
      { clientId: "google-client", clientSecret: "google-secret" }
    );
    expect(mocks.newSession.set).toHaveBeenCalledWith("userId", "user-1");
    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.headers.get("Location")).toBe("/");
    expect(response.headers.get("Set-Cookie")).toContain("__session=new");
    // Provider tokens are not stored for a sign-in.
    expect(mocks.sealCredential).not.toHaveBeenCalled();
    expect(expiresFlowCookie(result)).toBe(true);
  });

  it("revokes a pre-existing session instead of reusing it on sign-in", async () => {
    mocks.previousSession.id = "old-token";
    const { cookie, state } = await start("google", "sign-in");

    await completeOAuthFlow(callback("google", { code: "code", state }, cookie), "google");

    expect(mocks.destroySession).toHaveBeenCalledWith(mocks.previousSession);
    mocks.previousSession.id = "";
  });

  it("connects a calendar and stores its tokens encrypted on the server", async () => {
    mocks.getUserId.mockResolvedValue("user-1");
    const { cookie, state } = await start("outlook", "connect-calendar");

    const result = await completeOAuthFlow(
      callback("outlook", { code: "code", state }, cookie),
      "outlook"
    );

    expect(mocks.verifyOutlookCalendarAccess).toHaveBeenCalledWith("provider-at");
    expect(mocks.connectCalendarProvider).toHaveBeenCalledWith(
      "user-1",
      "outlook",
      "outlook-id",
      expect.any(Function)
    );
    // The repository seals the credential for the connection inside its transaction.
    const sealFor = mocks.connectCalendarProvider.mock.calls[0][3] as (id: string) => string;
    expect(sealFor("connection-1")).toBe("sealed");
    expect(mocks.sealCredential).toHaveBeenCalledWith("user-1", "connection-1", TOKENS);
    expect((result as Response).headers.get("Location")).toBe("/settings");
    expect(expiresFlowCookie(result)).toBe(true);
  });

  it("links a sign-in identity without storing tokens or changing the session", async () => {
    mocks.getUserId.mockResolvedValue("user-1");
    const { cookie, state } = await start("outlook", "link-identity");

    const result = await completeOAuthFlow(
      callback("outlook", { code: "code", state }, cookie),
      "outlook"
    );

    expect(mocks.linkProviderAccount).toHaveBeenCalledWith("user-1", "outlook", "outlook-id");
    expect(mocks.connectCalendarProvider).not.toHaveBeenCalled();
    expect(mocks.commitSession).not.toHaveBeenCalled();
    expect((result as Response).headers.get("Location")).toBe("/settings");
  });

  it("explains a link conflict instead of merging accounts", async () => {
    mocks.getUserId.mockResolvedValue("user-1");
    mocks.linkProviderAccount.mockResolvedValue("conflict");
    const { cookie, state } = await start("google", "link-identity");

    const result = await completeOAuthFlow(
      callback("google", { code: "code", state }, cookie),
      "google"
    );

    expect(failure(result)).toContain("never merged");
  });

  it("refuses a callback whose state does not match the flow", async () => {
    const { cookie } = await start("google", "sign-in");

    const result = await completeOAuthFlow(
      callback("google", { code: "code", state: "forged" }, cookie),
      "google"
    );

    expect(failure(result)).toContain("does not match");
    expect(mocks.exchangeAuthorizationCode).not.toHaveBeenCalled();
  });

  it("refuses a callback without the flow cookie", async () => {
    const result = await completeOAuthFlow(
      callback("google", { code: "code", state: "s" }),
      "google"
    );

    expect(failure(result)).toContain("expired or is missing");
    expect(mocks.exchangeAuthorizationCode).not.toHaveBeenCalled();
  });

  it("refuses a flow started for another provider", async () => {
    const { cookie, state } = await start("google", "sign-in");

    const result = await completeOAuthFlow(
      callback("outlook", { code: "code", state }, cookie),
      "outlook"
    );

    expect(failure(result)).toContain("does not match");
  });

  it("refuses to connect a calendar when the account changed during the flow", async () => {
    mocks.getUserId.mockResolvedValueOnce("user-1").mockResolvedValue("user-2");
    const { cookie, state } = await start("google", "connect-calendar");

    const result = await completeOAuthFlow(
      callback("google", { code: "code", state }, cookie),
      "google"
    );

    expect(failure(result)).toContain("signed out");
    expect(mocks.connectCalendarProvider).not.toHaveBeenCalled();
  });

  it("requires offline access before connecting a calendar", async () => {
    mocks.getUserId.mockResolvedValue("user-1");
    mocks.exchangeAuthorizationCode.mockResolvedValue({ ...TOKENS, refreshToken: undefined });
    const { cookie, state } = await start("google", "connect-calendar");

    const result = await completeOAuthFlow(
      callback("google", { code: "code", state }, cookie),
      "google"
    );

    expect(failure(result)).toContain("offline calendar access");
    expect(mocks.connectCalendarProvider).not.toHaveBeenCalled();
  });

  it("reports a provider denial without exchanging a code", async () => {
    const { cookie, state } = await start("google", "sign-in");

    const result = await completeOAuthFlow(
      callback("google", { error: "access_denied", state }, cookie),
      "google"
    );

    expect(failure(result)).toContain("access_denied");
    expect(mocks.exchangeAuthorizationCode).not.toHaveBeenCalled();
  });

  it("hides token-endpoint failure details from the page", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.exchangeAuthorizationCode.mockRejectedValue(
      new Error("google token endpoint failed: 400")
    );
    const { cookie, state } = await start("google", "sign-in");

    const result = await completeOAuthFlow(
      callback("google", { code: "code", state }, cookie),
      "google"
    );

    expect(failure(result)).toBe("Authorization could not be completed. Try again.");
    errorSpy.mockRestore();
  });
});

describe("publicOrigin", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses https behind the Cloud Run proxy in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(publicOrigin(new Request("http://dev.rjpnt.com/auth/google/start"))).toBe(
      "https://dev.rjpnt.com"
    );
  });

  it("keeps http for a local production run", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(publicOrigin(new Request("http://localhost:3000/auth/google/start"))).toBe(
      "http://localhost:3000"
    );
  });
});

describe("completeOAuthFlow failures", () => {
  it("expire the flow cookie and answer 400 on every failure path", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { cookie, state } = await start("google", "sign-in");
    const cases: Array<[string, Request]> = [
      ["provider denial", callback("google", { error: "access_denied", state }, cookie)],
      ["missing code", callback("google", { state }, cookie)],
      ["missing flow", callback("google", { code: "code", state })],
      ["state mismatch", callback("google", { code: "code", state: "forged" }, cookie)],
    ];
    for (const [name, request] of cases) {
      const result = await completeOAuthFlow(request, "google");
      expect(failure(result), name).not.toBeNull();
      expect(result instanceof Response ? result.status : result.init?.status, name).toBe(400);
      expect(expiresFlowCookie(result), name).toBe(true);
    }

    mocks.exchangeAuthorizationCode.mockRejectedValueOnce(new Error("token endpoint failed: 400"));
    const tokenFailure = await completeOAuthFlow(
      callback("google", { code: "code", state }, cookie),
      "google"
    );
    expect(expiresFlowCookie(tokenFailure)).toBe(true);
    errorSpy.mockRestore();
  });
});
