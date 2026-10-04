import { globalStyle } from "@vanilla-extract/css";
import { darkTheme, lightTheme, vars } from "../app/styles/theme.css";

globalStyle("body", {
  background: vars.color.background,
  color: vars.color.text,
  fontFamily: vars.font.body,
});

globalStyle(`html.${lightTheme}`, { colorScheme: "light" });
globalStyle(`html.${darkTheme}`, { colorScheme: "dark" });
