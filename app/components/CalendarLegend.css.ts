import { style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css";

export const list = style({
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
});

export const item = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space.sm,
  padding: `${vars.space.sm} 0`,
  borderBottom: `1px solid ${vars.color.border}`,
  ":last-child": { borderBottom: "none" },
});

export const glyph = style({ flex: "0 0 auto", color: vars.color.text });

export const label = style({ flex: "1 1 auto", fontSize: vars.fontSize.md });

export const meta = style({
  fontFamily: vars.font.mono,
  fontSize: "0.75rem",
  color: vars.color.textMuted,
});
