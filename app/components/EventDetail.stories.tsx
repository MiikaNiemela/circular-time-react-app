import { fn } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { EventDetail } from "./EventDetail";
import { ThemeProvider } from "./ThemeProvider";

const meta: Meta<typeof EventDetail> = {
  title: "Components/EventDetail",
  component: EventDetail,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <ThemeProvider>
        <div style={{ height: "300px", position: "relative" }}>
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
  args: { onClose: fn() },
};
export default meta;

type Story = StoryObj<typeof EventDetail>;

export const Default: Story = {
  args: {
    event: {
      id: "e1",
      calendarId: "google",
      title: "Team Standup",
      start: "2026-06-19T09:00:00.000Z",
      end: "2026-06-19T09:30:00.000Z",
      color: "#2563eb",
    },
  },
};

export const LongTitle: Story = {
  args: {
    event: {
      id: "e2",
      calendarId: "outlook",
      title: "Quarterly Business Review — All Hands — Leadership Team + Engineering",
      start: "2026-06-19T13:00:00.000Z",
      end: "2026-06-19T15:00:00.000Z",
      color: "#7c3aed",
    },
  },
};

export const AllDay: Story = {
  args: {
    event: {
      id: "e3",
      calendarId: "google",
      title: "Company Holiday",
      start: "2026-06-19T00:00:00.000Z",
      end: "2026-06-20T00:00:00.000Z",
      allDay: true,
    },
  },
};

export const NoCustomColor: Story = {
  args: {
    event: {
      id: "e4",
      calendarId: "google",
      title: "Focus Time",
      start: "2026-06-19T10:00:00.000Z",
      end: "2026-06-19T12:00:00.000Z",
    },
  },
};
