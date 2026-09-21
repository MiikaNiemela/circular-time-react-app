import { expect, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { createRoutesStub } from "react-router";
import Settings from "./settings";
import { ThemeProvider } from "../components/ThemeProvider";

// LocalStorage keys — must match the constants in the provider and visibility files.
const GOOGLE_TOKENS_KEY = "circular-time-google-tokens";
const OUTLOOK_TOKENS_KEY = "circular-time-outlook-tokens";
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

function renderSettings() {
  return (
    <ThemeProvider>
      <SettingsStub initialEntries={["/settings"]} />
    </ThemeProvider>
  );
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

/** No tokens in localStorage — all three calendar rows show a Connect button. */
export const AllDisconnected: Story = {
  beforeEach: () => {
    localStorage.removeItem(GOOGLE_TOKENS_KEY);
    localStorage.removeItem(OUTLOOK_TOKENS_KEY);
    localStorage.removeItem(VISIBILITY_KEY);
  },
  render: renderSettings,
};

/**
 * Google Calendar is pre-connected (token seeded in localStorage before the
 * component mounts). The visibility toggle is checked by default.
 *
 * The `play` function toggles the switch off, asserts the checkbox is
 * unchecked, then toggles it back on — verifying the toggle wires through to
 * `CalendarVisibilityStore` and back to the component's controlled state.
 */
export const GoogleConnected: Story = {
  beforeEach: () => {
    localStorage.setItem(
      GOOGLE_TOKENS_KEY,
      JSON.stringify({
        accessToken: "mock-access-token",
        expiresAt: Date.now() + 3_600_000,
      })
    );
    return () => {
      localStorage.removeItem(GOOGLE_TOKENS_KEY);
      localStorage.removeItem(VISIBILITY_KEY);
    };
  },
  render: renderSettings,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The checkbox itself is visually hidden (opacity:0 CSS toggle); click the
    // wrapping <label> so the pointer lands on its visible 36×20 px area.
    const checkbox = canvas.getByRole("checkbox", { name: "Enable Google Calendar" });
    const label = checkbox.closest("label") as HTMLElement;
    expect(checkbox).toBeChecked();
    await userEvent.click(label);
    expect(checkbox).not.toBeChecked();
    await userEvent.click(label);
    expect(checkbox).toBeChecked();
  },
};
