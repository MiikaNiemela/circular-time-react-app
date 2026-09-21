import { fn } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { SegmentedControl } from "./SegmentedControl";
import { ThemeProvider } from "./ThemeProvider";

const meta: Meta<typeof SegmentedControl> = {
  title: "Components/SegmentedControl",
  component: SegmentedControl,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    ),
  ],
  args: { onChange: fn() },
};
export default meta;

type Story = StoryObj<typeof SegmentedControl>;

export const Day: Story = { args: { value: "day" } };
export const Week: Story = { args: { value: "week" } };
export const Month: Story = { args: { value: "month" } };
export const Year: Story = { args: { value: "year" } };
