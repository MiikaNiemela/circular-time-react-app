import type { Meta, StoryObj } from "@storybook/react-vite";
import { DarkModeToggle } from "./DarkModeToggle";

const meta: Meta<typeof DarkModeToggle> = {
  title: "Components/DarkModeToggle",
  component: DarkModeToggle,
};
export default meta;

type Story = StoryObj<typeof DarkModeToggle>;

export const Default: Story = {};
