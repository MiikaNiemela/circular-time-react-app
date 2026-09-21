import type { Meta, StoryObj } from "@storybook/react-vite";
import { DarkModeToggle } from "./DarkModeToggle";
import { ThemeProvider } from "./ThemeProvider";

const meta: Meta<typeof DarkModeToggle> = {
  title: "Components/DarkModeToggle",
  component: DarkModeToggle,
  decorators: [
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof DarkModeToggle>;

export const Default: Story = {};
