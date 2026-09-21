import { style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css";

export const button = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: vars.space.xs,
  padding: `${vars.space.xs} ${vars.space.sm}`,
  borderRadius: vars.radius.full,
  border: `1px solid ${vars.color.border}`,
  background: vars.color.surface,
  color: vars.color.text,
  fontSize: vars.fontSize.sm,
  fontFamily: vars.font.body,
  cursor: "pointer",
  transition: "background 0.15s, color 0.15s, border-color 0.15s",
  ":hover": {
    background: vars.color.accent,
    color: vars.color.onAccent,
    borderColor: vars.color.accent,
  },
  ":focus-visible": {
    outline: `2px solid ${vars.color.accent}`,
    outlineOffset: "2px",
  },
});
