import { style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css";

export const box = style({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: vars.space.sm,
  textAlign: "center",
  maxWidth: "36ch",
  marginInline: "auto",
});

export const message = style({
  margin: 0,
  color: vars.color.textMuted,
  fontSize: vars.fontSize.sm,
});

/** The one action a state offers, styled as a secondary button. */
export const action = style({
  padding: `${vars.space.xs} ${vars.space.md}`,
  borderRadius: vars.radius.sm,
  border: `1px solid ${vars.color.accent}`,
  background: "transparent",
  color: vars.color.accent,
  font: "inherit",
  fontSize: vars.fontSize.sm,
  textDecoration: "none",
  cursor: "pointer",
  ":focus-visible": { outline: `2px solid ${vars.color.accent}`, outlineOffset: "2px" },
});
