import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import Settings from "./settings";
import { ThemeProvider } from "../components/ThemeProvider";
import { GoogleTokenStore } from "../data/providers/google";

function renderSettings() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <Settings />
      </ThemeProvider>
    </MemoryRouter>
  );
}

// Seed a connected Google calendar the way the OAuth callback would. This is the
// only path to the connected UI now: Google/Outlook Connect buttons redirect to
// OAuth, and iCal is a not-yet-implemented placeholder (Milestone 3.5), so none
// of them flip a provider to "connected" inline. Visibility defaults to true.
function connectGoogle() {
  new GoogleTokenStore().set({ accessToken: "at", expiresAt: Date.now() + 3_600_000 });
}

describe("Settings route", () => {
  beforeEach(() => localStorage.clear());

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

  it("a connected calendar shows Disconnect and a visibility toggle", () => {
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

  it("disconnecting a provider resets it to not connected", () => {
    connectGoogle();
    const { getByRole, getAllByText } = renderSettings();
    fireEvent.click(getByRole("button", { name: "Disconnect" }));
    expect(getAllByText("Not connected").length).toBe(3);
  });

  it("has a back link to the home route", () => {
    const { getByRole } = renderSettings();
    const backLink = getByRole("link", { name: /back/i });
    expect(backLink.getAttribute("href")).toBe("/");
  });
});
