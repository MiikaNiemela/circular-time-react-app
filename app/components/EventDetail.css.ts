import { style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css";

export const overlay = style({
  position: "fixed",
  inset: 0,
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
  padding: vars.space.md,
  pointerEvents: "none",
  zIndex: 100,
});

export const card = style({
  pointerEvents: "auto",
  background: vars.color.surface,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  padding: vars.space.md,
  width: "100%",
  maxWidth: "480px",
  display: "flex",
  alignItems: "center",
  gap: vars.space.md,
  boxShadow: `0 4px 24px ${vars.color.overlayShadow}`,
});

export const swatch = style({
  width: "12px",
  height: "12px",
  borderRadius: "50%",
  flexShrink: 0,
});

export const info = style({
  flex: 1,
  minWidth: 0,
});

export const eventTitle = style({
  fontSize: vars.fontSize.md,
  fontFamily: vars.font.body,
  fontWeight: 600,
  color: vars.color.text,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

export const eventTime = style({
  fontSize: vars.fontSize.sm,
  fontFamily: vars.font.body,
  color: vars.color.textMuted,
  marginTop: "2px",
});

export const closeBtn = style({
  background: "none",
  border: "none",
  color: vars.color.textMuted,
  fontSize: vars.fontSize.lg,
  lineHeight: 1,
  cursor: "pointer",
  padding: vars.space.xs,
  borderRadius: vars.radius.sm,
  flexShrink: 0,
  ":hover": { color: vars.color.text },
  ":focus-visible": {
    outline: `2px solid ${vars.color.accent}`,
    outlineOffset: "1px",
  },
});
