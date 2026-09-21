import type { Meta, StoryObj } from "@storybook/react-vite";
import { createRoutesStub } from "react-router";
import SignIn from "./sign-in";
import { ThemeProvider } from "../components/ThemeProvider";

function HomeStub() {
  return <div style={{ padding: "2rem" }}>Timeline (you are signed in)</div>;
}

const SignInStub = createRoutesStub([
  { path: "/sign-in", Component: SignIn },
  { path: "/", Component: HomeStub },
]);

function renderSignIn() {
  return (
    <ThemeProvider>
      <div style={{ minHeight: "100dvh" }}>
        <SignInStub initialEntries={["/sign-in"]} />
      </div>
    </ThemeProvider>
  );
}

const meta: Meta = {
  title: "Routes/SignIn",
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj;

/** Unauthenticated visitor sees the sign-in page with Google and Outlook buttons. */
export const Unauthenticated: Story = {
  beforeEach: () => {
    localStorage.clear();
    return () => localStorage.clear();
  },
  render: renderSignIn,
};
