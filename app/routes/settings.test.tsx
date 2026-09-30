import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const fetchMock = vi.hoisted(() => vi.fn());
const serverMocks = vi.hoisted(() => ({
  getUserId: vi.fn(),
  getSignInProviders: vi.fn(),
  getConnectedProviders: vi.fn(),
}));

// buildConfig is mocked so tests can toggle isProduction without patching
// import.meta.env; the session module is server-only and imported by the loader.
vi.mock("../lib/buildConfig", () => ({ isProduction: vi.fn(() => false) }));
vi.mock("../lib/session.server", () => ({ getUserId: serverMocks.getUserId }));
vi.mock("../lib/userRepository.server", () => ({
  userRepository: {
    getSignInProviders: serverMocks.getSignInProviders,
    getConnectedProviders: serverMocks.getConnectedProviders,
  },
}));

import Settings, { loader } from "./settings";
import { isProduction } from "../lib/buildConfig";
import { ThemeProvider } from "../components/ThemeProvider";

function renderSettings(signInProviders?: string[], connectedProviders: string[] = []) {
  const loaderData = signInProviders ? { signInProviders, connectedProviders } : null;
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <Settings {...({ loaderData } as unknown as Parameters<typeof Settings>[0])} />
      </ThemeProvider>
    </MemoryRouter>
  );
}

/** The hidden intent and target of the form a button submits. */
function oauthForm(button: HTMLElement) {
  const form = (button as HTMLButtonElement).form!;
  return {
    method: form.getAttribute("method"),
    action: form.getAttribute("action"),
    intent: (form.elements.namedItem("intent") as HTMLInputElement | null)?.value,
  };
}

describe("Settings route", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
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

  it("shows a Connect button for each disconnected provider", () => {
    const { getAllByRole } = renderSettings();
    expect(getAllByRole("button", { name: /^Connect/ }).length).toBe(3);
  });

  // iCal auth lands in Milestone 3.5; until then Connect only alerts.
  it("iCal Connect alerts and leaves the calendar disconnected", () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const { getAllByRole, getAllByText } = renderSettings();
    fireEvent.click(getAllByRole("button", { name: /^Connect/ })[2]);
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(getAllByText("Not connected").length).toBe(3);
    alertSpy.mockRestore();
  });

  it("connects Google through a server-side calendar-connection flow", () => {
    const { getByRole } = renderSettings();

    expect(oauthForm(getByRole("button", { name: "Connect Google Calendar" }))).toEqual({
      method: "post",
      action: "/auth/google/start",
      intent: "connect-calendar",
    });
  });

  it("connects Outlook through a server-side calendar-connection flow", () => {
    const { getByRole } = renderSettings();

    expect(oauthForm(getByRole("button", { name: "Connect Outlook / Microsoft 365" }))).toEqual({
      method: "post",
      action: "/auth/outlook/start",
      intent: "connect-calendar",
    });
  });

  it("makes a calendar visible again when it is reconnected", () => {
    localStorage.setItem("circular-time-calendar-visibility", JSON.stringify({ google: false }));
    const { getByRole } = renderSettings();
    const form = (getByRole("button", { name: "Connect Google Calendar" }) as HTMLButtonElement)
      .form!;
    // jsdom does not implement navigation; stop the submission after handlers run.
    form.addEventListener("submit", (event) => event.preventDefault());

    fireEvent.submit(form);

    expect(JSON.parse(localStorage.getItem("circular-time-calendar-visibility")!)).toEqual({
      google: true,
    });
  });

  it("shows server-side calendar connections with Disconnect and a visibility toggle", () => {
    const { getByText, getByRole, getByLabelText } = renderSettings(["google"], ["google"]);
    expect(getByText("Connected")).toBeTruthy();
    expect(getByRole("button", { name: "Disconnect" })).toBeTruthy();
    expect(getByLabelText("Enable Google Calendar")).toBeTruthy();
  });

  it("toggles a connected calendar's visibility and persists it", () => {
    const { getByLabelText } = renderSettings(["google"], ["google"]);
    const toggle = getByLabelText("Enable Google Calendar") as HTMLInputElement;
    expect(toggle.checked).toBe(true);
    fireEvent.click(toggle);
    expect(toggle.checked).toBe(false);
    expect(JSON.parse(localStorage.getItem("circular-time-calendar-visibility")!)).toEqual({
      google: false,
    });
  });

  it("disconnects a calendar through the authenticated server endpoint", async () => {
    const { getByRole, getAllByText } = renderSettings(["google"], ["google"]);
    fireEvent.click(getByRole("button", { name: "Disconnect" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/auth/calendar-disconnection");
    expect(request).toMatchObject({ method: "POST" });
    expect(JSON.parse(String(request.body))).toEqual({ provider: "google" });
    await waitFor(() => expect(getAllByText("Not connected").length).toBe(3));
  });

  it("keeps the calendar connected when the server refuses the disconnect", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    fetchMock.mockResolvedValue(new Response("{}", { status: 503 }));
    const { getByRole, getByText } = renderSettings(["google"], ["google"]);

    fireEvent.click(getByRole("button", { name: "Disconnect" }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledOnce());
    expect(getByText("Connected")).toBeTruthy();
    alertSpy.mockRestore();
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
  });

  it("shows which providers can sign in and offers Link only for the others", () => {
    const { getByRole, getByText, queryByRole } = renderSettings(["google"]);
    const list = getByRole("list", { name: "Sign-in accounts" });
    expect(list.textContent).toContain("Can sign in to this account");
    expect(getByText("Not linked")).toBeTruthy();
    expect(queryByRole("button", { name: "Link Google account" })).toBeNull();
    expect(getByRole("button", { name: "Link Microsoft (Outlook) account" })).toBeTruthy();
  });

  it("starts an identity-only link flow instead of a calendar connection", () => {
    const { getByRole } = renderSettings(["google"]);

    expect(oauthForm(getByRole("button", { name: "Link Microsoft (Outlook) account" }))).toEqual({
      method: "post",
      action: "/auth/outlook/start",
      intent: "link-identity",
    });
  });

  it("hides the section without an application session", () => {
    const { queryByRole } = renderSettings();
    expect(queryByRole("list", { name: "Sign-in accounts" })).toBeNull();
  });
});

describe("Settings route — sign out", () => {
  it("posts a sign-out form to the session endpoint", () => {
    const { getByRole } = renderSettings(["google"]);
    const button = getByRole("button", { name: "Sign out" }) as HTMLButtonElement;

    expect(button.type).toBe("submit");
    expect(button.form?.getAttribute("method")).toBe("post");
    expect(button.form?.getAttribute("action")).toBe("/auth/sign-out");
  });

  it("offers no sign-out without an application session", () => {
    const { queryByRole } = renderSettings();
    expect(queryByRole("button", { name: "Sign out" })).toBeNull();
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

  it("serves the account's sign-in identities and calendar connections", async () => {
    serverMocks.getUserId.mockResolvedValue("user-1");
    serverMocks.getSignInProviders.mockResolvedValue(["google"]);
    serverMocks.getConnectedProviders.mockResolvedValue(["outlook"]);
    vi.mocked(isProduction).mockReturnValue(true);
    const request = new Request("http://localhost/settings");

    await expect(loader({ request } as Parameters<typeof loader>[0])).resolves.toEqual({
      signInProviders: ["google"],
      connectedProviders: ["outlook"],
    });
    expect(serverMocks.getSignInProviders).toHaveBeenCalledWith("user-1");
    expect(serverMocks.getConnectedProviders).toHaveBeenCalledWith("user-1");
  });

  it("keeps settings reachable without a session in development", async () => {
    serverMocks.getUserId.mockResolvedValue(null);
    vi.mocked(isProduction).mockReturnValue(false);
    const request = new Request("http://localhost/settings");

    await expect(loader({ request } as Parameters<typeof loader>[0])).resolves.toBeNull();
  });
});
