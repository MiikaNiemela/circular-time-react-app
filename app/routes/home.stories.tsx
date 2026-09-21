import { expect, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { createRoutesStub } from "react-router";
import Home from "./home";
import { ThemeProvider } from "../components/ThemeProvider";

// Stub the settings route so the <Link to="/settings"> in the empty-state
// prompt navigates without a full router.
function SettingsStub() {
  return <div data-testid="settings-stub">Settings</div>;
}

const HomeStub = createRoutesStub([
  {
    path: "/",
    Component: Home,
    // Provide the loader data shape the component now expects from useLoaderData().
    // Empty serverCalendars triggers the cold-cache path so the dev fixture renders.
    loader: () => ({
      serverCalendars: [],
      view: "day",
      ref: new Date().toISOString().slice(0, 10),
    }),
  },
  { path: "/settings", Component: SettingsStub },
]);

function renderHome() {
  return (
    <ThemeProvider>
      <div style={{ minHeight: "100dvh" }}>
        <HomeStub initialEntries={["/"]} />
      </div>
    </ThemeProvider>
  );
}

const meta: Meta = {
  title: "Routes/Home",
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj;

/**
 * Dev fixture active: no OAuth tokens in localStorage so the fixture calendars
 * are injected, producing two event rings. Clicking a fixture event opens the
 * EventDetail overlay — this exercises the click→detail flow without OAuth.
 *
 * Ring 1 (index 0) is the dev-google calendar (background grid is hidden by
 * default). Segment 2 is the "Standup" event (sliceIndex 1, preceded by
 * the pre-event gap at sliceIndex 0 which is transparent and not a button).
 */
export const WithDevFixture: Story = {
  beforeEach: () => {
    localStorage.clear();
    return () => localStorage.clear();
  },
  render: renderHome,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Wait for the dev-google event ring to appear; segment 2 is the Focus block.
    const eventSlice = await canvas.findByRole("button", { name: "Ring 1 segment 2" });
    await userEvent.click(eventSlice);
    const dialog = await canvas.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("Standup")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Close" }));
    expect(canvas.queryByRole("dialog")).not.toBeInTheDocument();
  },
};
