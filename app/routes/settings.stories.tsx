import { expect, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { createRoutesStub } from "react-router";
import Settings from "./settings";

// Must match the constant in app/data/calendarVisibility.ts.
const VISIBILITY_KEY = "circular-time-calendar-visibility";

function HomeStub() {
  return <div data-testid="home-stub" />;
}

/**
 * Wrap Settings in a React Router context so the Link component (← Back)
 * resolves correctly without triggering a real navigation.
 */
const SettingsStub = createRoutesStub([
  { path: "/", Component: HomeStub },
  { path: "/settings", Component: Settings },
]);

/** Settings for a signed-in account whose Google identity can sign in. */
const SignedInSettingsStub = createRoutesStub([
  { path: "/", Component: HomeStub },
  {
    path: "/settings",
    Component: Settings as never,
    loader: () => ({ signInProviders: ["google"], connectedProviders: [] }),
  },
]);

/** Settings for an account that can sign in with Google and Microsoft. */
const TwoIdentitiesSettingsStub = createRoutesStub([
  { path: "/", Component: HomeStub },
  {
    path: "/settings",
    Component: Settings as never,
    loader: () => ({ signInProviders: ["google", "outlook"], connectedProviders: [] }),
  },
]);

/** Settings for a signed-in account with a server-side Google calendar connection. */
const GoogleConnectedSettingsStub = createRoutesStub([
  { path: "/", Component: HomeStub },
  {
    path: "/settings",
    Component: Settings as never,
    loader: () => ({ signInProviders: ["google"], connectedProviders: ["google"] }),
  },
]);

function renderSettings() {
  return <SettingsStub initialEntries={["/settings"]} />;
}

const meta: Meta<typeof Settings> = {
  title: "Routes/Settings",
  component: Settings,
  parameters: {
    layout: "fullscreen",
  },
};
export default meta;

type Story = StoryObj<typeof Settings>;

/** No calendar connections — all three calendar rows show a Connect button. */
export const AllDisconnected: Story = {
  beforeEach: () => {
    localStorage.removeItem(VISIBILITY_KEY);
  },
  render: renderSettings,
};

/**
 * Google Calendar is connected on the server (the loader reports it). The
 * visibility toggle is checked by default.
 *
 * The `play` function toggles the switch off, asserts the checkbox is
 * unchecked, then toggles it back on — verifying the toggle wires through to
 * `CalendarVisibilityStore` and back to the component's controlled state.
 */
export const GoogleConnected: Story = {
  beforeEach: () => {
    localStorage.removeItem(VISIBILITY_KEY);
    return () => localStorage.removeItem(VISIBILITY_KEY);
  },
  render: () => <GoogleConnectedSettingsStub initialEntries={["/settings"]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The checkbox itself is visually hidden (opacity:0 CSS toggle); click the
    // wrapping <label> so the pointer lands on its visible 36×20 px area.
    const checkbox = await canvas.findByRole("checkbox", { name: "Enable Google Calendar" });
    const label = checkbox.closest("label") as HTMLElement;
    expect(checkbox).toBeChecked();
    await userEvent.click(label);
    expect(checkbox).not.toBeChecked();
    await userEvent.click(label);
    expect(checkbox).toBeChecked();
  },
};

/**
 * A signed-in account with only a Google sign-in identity. The Sign-in accounts
 * section marks Google as able to sign in and offers Link for Microsoft only;
 * the Account section offers Sign out.
 */
export const SignInAccounts: Story = {
  render: () => <SignedInSettingsStub initialEntries={["/settings"]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const list = await canvas.findByRole("list", { name: "Sign-in accounts" });
    await expect(
      within(list).getByText("Can sign in to this account · the only sign-in account")
    ).toBeInTheDocument();
    // The only sign-in account cannot be removed.
    await expect(
      within(list).queryByRole("button", { name: /^Remove .* sign-in account$/ })
    ).not.toBeInTheDocument();
    await expect(
      within(list).getByRole("button", { name: "Link Microsoft (Outlook) account" })
    ).toBeInTheDocument();
    await expect(
      within(list).queryByRole("button", { name: "Link Google account" })
    ).not.toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  },
};

/**
 * An account that can sign in with Google and Microsoft. Each has Remove;
 * removing Microsoft (the server is stubbed to accept) leaves Google as the
 * only sign-in account, which then cannot be removed.
 */
export const RemoveSignInAccount: Story = {
  beforeEach: () => {
    const original = window.fetch;
    window.fetch = async () => new Response(JSON.stringify({ ok: true }));
    return () => {
      window.fetch = original;
    };
  },
  render: () => <TwoIdentitiesSettingsStub initialEntries={["/settings"]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const list = await canvas.findByRole("list", { name: "Sign-in accounts" });
    await userEvent.click(
      within(list).getByRole("button", { name: "Remove Microsoft (Outlook) sign-in account" })
    );
    await expect(
      await within(list).findByRole("button", { name: "Link Microsoft (Outlook) account" })
    ).toBeInTheDocument();
    await expect(
      within(list).queryByRole("button", { name: "Remove Google sign-in account" })
    ).not.toBeInTheDocument();
  },
};
