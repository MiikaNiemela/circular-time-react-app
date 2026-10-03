import { style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css";

export const list = style({
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexWrap: "wrap",
  gap: vars.space.sm,
});

export const chip = style({
  display: "inline-flex",
  alignItems: "center",
  gap: vars.space.xs,
  padding: `${vars.space.xs} ${vars.space.sm} ${vars.space.xs} ${vars.space.xs}`,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.full,
  background: vars.color.background,
  color: vars.color.text,
  font: "inherit",
  fontSize: vars.fontSize.sm,
  cursor: "pointer",
  ":focus-visible": { outline: `2px solid ${vars.color.accent}`, outlineOffset: "2px" },
});

export const icon = style({ flex: "0 0 auto" });

export const empty = style({ margin: 0, color: vars.color.textMuted, fontSize: vars.fontSize.sm });
