import { style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css";

export const page = style({
  minHeight: "100dvh",
  background: vars.color.background,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: vars.space.lg,
  fontFamily: vars.font.body,
  color: vars.color.text,
});

export const card = style({
  width: "100%",
  maxWidth: "360px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: vars.space.lg,
});

export const heading = style({
  fontSize: vars.fontSize.xl,
  fontWeight: "700",
  margin: 0,
  textAlign: "center",
  color: vars.color.text,
});

export const subtitle = style({
  fontSize: vars.fontSize.sm,
  color: vars.color.textMuted,
  textAlign: "center",
  margin: 0,
  lineHeight: "1.5",
});

export const buttons = style({
  width: "100%",
  display: "flex",
  flexDirection: "column",
  gap: vars.space.sm,
});

export const providerButton = style({
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: vars.space.sm,
  padding: `${vars.space.sm} ${vars.space.md}`,
  borderRadius: vars.radius.md,
  border: `1px solid ${vars.color.border}`,
  background: vars.color.surface,
  color: vars.color.text,
  fontSize: vars.fontSize.md,
  fontFamily: vars.font.body,
  cursor: "pointer",
  transition: "border-color 0.15s, background 0.15s",
  ":hover": {
    borderColor: vars.color.accent,
    background: vars.color.background,
  },
  ":focus-visible": {
    outline: `2px solid ${vars.color.accent}`,
    outlineOffset: "2px",
  },
});
