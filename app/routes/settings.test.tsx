import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const providerAuthMocks = vi.hoisted(() => ({
  startGoogleCalendarConnection: vi.fn(),
  startOutlookCalendarConnection: vi.fn(),
  startGoogleIdentityLink: vi.fn(),
  startOutlookIdentityLink: vi.fn(),
  fetch: vi.fn(),
}));

const tokenStoreMocks = vi.hoisted(() => ({
  googleToken: null as { accessToken: string; expiresAt?: number } | null,
  outlookToken: null as { accessToken: string; expiresAt?: number } | null,
}));

const serverMocks = vi.hoisted(() => ({ getUserId: vi.fn(), getSignInProviders: vi.fn() }));

vi.mock("../lib/providerAuth", () => providerAuthMocks);
// buildConfig is mocked so tests can toggle isProduction without patching
// import.meta.env; the session module is server-only and imported by the loader.
vi.mock("../lib/buildConfig", () => ({ isProduction: vi.fn(() => false) }));
vi.mock("../lib/session.server", () => ({ getUserId: serverMocks.getUserId }));
vi.mock("../lib/userRepository.server", () => ({
  userRepository: { getSignInProviders: serverMocks.getSignInProviders },
}));
vi.mock("../data/providers/google", () => ({
  GoogleTokenStore: class {
    get() {
      return tokenStoreMocks.googleToken;
    }
    set(token: { accessToken: string; expiresAt?: number }) {
      tokenStoreMocks.googleToken = token;
    }
    clear() {
      tokenStoreMocks.googleToken = null;
    }
  },
}));
vi.mock("../data/providers/outlook", () => ({
  OutlookTokenStore: class {
    get() {
      return tokenStoreMocks.outlookToken;
    }
    set(token: { accessToken: string; expiresAt?: number }) {
      tokenStoreMocks.outlookToken = token;
    }
    clear() {
      tokenStoreMocks.outlookToken = null;
    }
  },
}));

import Settings, { loader } from "./settings";
import { isProduction } from "../lib/buildConfig";
import { ThemeProvider } from "../components/ThemeProvider";

function renderSettings(signInProviders?: string[]) {
  const loaderData = signInProviders ? { signInProviders } : null;
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <Settings {...({ loaderData } as unknown as Parameters<typeof Settings>[0])} />
      </ThemeProvider>
    </MemoryRouter>
  );
}

// Seed a connected Google calendar the way the OAuth callback would. This is the
// only path to the connected UI now: Google/Outlook Connect buttons redirect to
// OAuth, and iCal is a not-yet-implemented placeholder (Milestone 3.5), so none
// of them flip a provider to "connected" inline. Visibility defaults to true.
function connectGoogle() {
  tokenStoreMocks.googleToken = { accessToken: "at", expiresAt: Date.now() + 3_600_000 };
}

describe("Settings route", () => {
  beforeEach(() => {
    localStorage.clear();
    tokenStoreMocks.googleToken = null;
    tokenStoreMocks.outlookToken = null;
    vi.clearAllMocks();
    providerAuthMocks.startGoogleCalendarConnection.mockResolvedValue(
      "https://accounts.google.com/oauth"
    );
    providerAuthMocks.startOutlookCalendarConnection.mockResolvedValue(
      "https://login.microsoftonline.com/oauth"
    );
    providerAuthMocks.fetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    vi.stubGlobal("fetch", providerAuthMocks.fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders a calendar list with three providers", () => {
    const { getByText } = renderSettings();
    expect(getByText("Google Calendar")).toBeTruthy();
    expect(getByText("Outlook / Microsoft 365")).toBeTruthy();
    expect(getByText("iCal / CalDAV")).toBeTruthy();
  });

  it("shows all providers as not connected initially", () => {
    const { getAllByText } = renderSettings();
    expect(getAllByText("Not connected").length).toBe(3);
  });

  it("shows Connect button for each disconnected provider", () => {
    const { getAllByRole } = renderSettings();
    expect(getAllByRole("button", { name: "Connect" }).length).toBe(3);
  });

  // iCal auth lands in Milestone 3.5; until then Connect only alerts.
  it("iCal Connect alerts and leaves the calendar disconnected", () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const { getAllByRole, getAllByText } = renderSettings();
    fireEvent.click(getAllByRole("button", { name: "Connect" })[2]);
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(getAllByText("Not connected").length).toBe(3);
    alertSpy.mockRestore();
  });

  it("starts an explicit Google calendar-connection flow", async () => {
    const { getAllByRole } = renderSettings();
    fireEvent.click(getAllByRole("button", { name: "Connect" })[0]);

    await waitFor(() =>
      expect(providerAuthMocks.startGoogleCalendarConnection).toHaveBeenCalledOnce()
    );
  });

  it("starts an explicit Outlook calendar-connection flow", async () => {
    const { getAllByRole } = renderSettings();
    fireEvent.click(getAllByRole("button", { name: "Connect" })[1]);

    await waitFor(() =>
      expect(providerAuthMocks.startOutlookCalendarConnection).toHaveBeenCalledOnce()
    );
  });

  it("a connected calendar shows Disconnect and a visibility toggle", async () => {
    connectGoogle();
    const { getByText, getByRole, getByLabelText } = renderSettings();
    expect(getByText("Connected")).toBeTruthy();
    expect(getByRole("button", { name: "Disconnect" })).toBeTruthy();
    expect(getByLabelText("Enable Google Calendar")).toBeTruthy();
  });

  it("toggle enables/disables a connected provider", () => {
    connectGoogle();
    const { getByLabelText } = renderSettings();
    const toggle = getByLabelText("Enable Google Calendar") as HTMLInputElement;
    expect(toggle.checked).toBe(true);
    fireEvent.click(toggle);
    expect(toggle.checked).toBe(false);
  });

  it("disconnects a provider through the authenticated server endpoint before clearing browser state", async () => {
    connectGoogle();
    const { getByRole, getAllByText } = renderSettings();
    fireEvent.click(getByRole("button", { name: "Disconnect" }));

    await waitFor(() => expect(providerAuthMocks.fetch).toHaveBeenCalledOnce());
    const [url, request] = providerAuthMocks.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/auth/calendar-disconnection");
    expect(request).toMatchObject({ method: "POST" });
    expect(JSON.parse(String(request.body))).toEqual({ provider: "google" });
    await waitFor(() => expect(getAllByText("Not connected").length).toBe(3));
  });

  it("has a back link to the home route", () => {
    const { getByRole } = renderSettings();
    const backLink = getByRole("link", { name: /back/i });
    expect(backLink.getAttribute("href")).toBe("/");
  });
});

describe("Settings route — sign-in accounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    providerAuthMocks.startGoogleIdentityLink.mockResolvedValue(
      "https://accounts.google.com/oauth"
    );
    providerAuthMocks.startOutlookIdentityLink.mockResolvedValue(
      "https://login.microsoftonline.com/oauth"
    );
  });

  it("shows which providers can sign in and offers Link only for the others", () => {
    const { getByRole, getByText, queryByRole } = renderSettings(["google"]);
    const list = getByRole("list", { name: "Sign-in accounts" });
    expect(list.textContent).toContain("Can sign in to this account");
    expect(getByText("Not linked")).toBeTruthy();
    expect(queryByRole("button", { name: "Link Google account" })).toBeNull();
    expect(getByRole("button", { name: "Link Microsoft (Outlook) account" })).toBeTruthy();
  });

  it("starts an identity-only link flow instead of a calendar connection", async () => {
    const { getByRole } = renderSettings(["google"]);
    fireEvent.click(getByRole("button", { name: "Link Microsoft (Outlook) account" }));

    await waitFor(() => expect(providerAuthMocks.startOutlookIdentityLink).toHaveBeenCalledOnce());
    expect(providerAuthMocks.startOutlookCalendarConnection).not.toHaveBeenCalled();
  });

  it("hides the section without an application session", () => {
    const { queryByRole } = renderSettings();
    expect(queryByRole("list", { name: "Sign-in accounts" })).toBeNull();
  });
});

describe("Settings route — server auth gate", () => {
  beforeEach(() => {
    vi.mocked(isProduction).mockReturnValue(false);
  });

  it("redirects unauthenticated production requests to sign-in", async () => {
    serverMocks.getUserId.mockResolvedValue(null);
    vi.mocked(isProduction).mockReturnValue(true);
    const request = new Request("http://localhost/settings");

    const result = loader({ request } as Parameters<typeof loader>[0]);

    await expect(result).rejects.toMatchObject({ status: 302 });
    await result.catch((response: Response) => {
      expect(response.headers.get("Location")).toBe("/sign-in");
    });
  });

  it("serves settings with the account's sign-in providers to an authenticated session", async () => {
    serverMocks.getUserId.mockResolvedValue("user-1");
    serverMocks.getSignInProviders.mockResolvedValue(["google"]);
    vi.mocked(isProduction).mockReturnValue(true);
    const request = new Request("http://localhost/settings");

    await expect(loader({ request } as Parameters<typeof loader>[0])).resolves.toEqual({
      signInProviders: ["google"],
    });
    expect(serverMocks.getSignInProviders).toHaveBeenCalledWith("user-1");
  });

  it("keeps settings reachable without a session in development", async () => {
    serverMocks.getUserId.mockResolvedValue(null);
    vi.mocked(isProduction).mockReturnValue(false);
    const request = new Request("http://localhost/settings");

    await expect(loader({ request } as Parameters<typeof loader>[0])).resolves.toBeNull();
  });
});
