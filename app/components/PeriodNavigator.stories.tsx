import { fn } from "storybook/test";
import { expect, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { PeriodNavigator } from "./PeriodNavigator";
import { ThemeProvider } from "./ThemeProvider";

const reference = new Date(2026, 5, 19); // Fri 19 Jun 2026

const meta: Meta<typeof PeriodNavigator> = {
  title: "Components/PeriodNavigator",
  component: PeriodNavigator,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    ),
  ],
  args: { onChange: fn(), value: reference, now: reference },
};
export default meta;

type Story = StoryObj<typeof PeriodNavigator>;

export const Day: Story = { args: { view: "day" } };
export const Week: Story = { args: { view: "week" } };
export const Month: Story = { args: { view: "month" } };
export const Year: Story = { args: { view: "year" } };

/** Browsed away from today: the Today reset appears. */
export const AwayFromToday: Story = {
  args: { view: "month", value: new Date(2026, 2, 19), now: reference },
};

/** Clicking next steps the reference forward one unit. */
export const StepsForward: Story = {
  args: { view: "day" },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByLabelText("Next period"));
    await expect(args.onChange).toHaveBeenCalledOnce();
  },
};
