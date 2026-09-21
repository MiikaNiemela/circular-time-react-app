import { style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css";
import { breakpoints } from "../styles/breakpoints";

export const container = style({
  display: "inline-flex",
  alignItems: "center",
  gap: vars.space.sm,
});

export const arrow = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  // 44px touch target on mobile; 32px on precise-pointer screens.
  width: "44px",
  height: "44px",
  borderRadius: vars.radius.full,
  border: `1px solid ${vars.color.border}`,
  background: vars.color.surface,
  color: vars.color.text,
  fontSize: vars.fontSize.lg,
  lineHeight: 1,
  cursor: "pointer",
  transition: "background 0.15s, color 0.15s",
  ":hover": {
    background: vars.color.accent,
    color: vars.color.onAccent,
  },
  ":focus-visible": {
    outline: `2px solid ${vars.color.accent}`,
    outlineOffset: "1px",
  },
  "@media": {
    [breakpoints.md]: {
      width: "32px",
      height: "32px",
    },
  },
});

export const label = style({
  minWidth: "11ch",
  textAlign: "center",
  fontSize: vars.fontSize.md,
  fontFamily: vars.font.body,
  color: vars.color.text,
  fontVariantNumeric: "tabular-nums",
});

export const today = style({
  // 12px vertical padding + ~20px line-height = 44px touch target on mobile.
  padding: `12px ${vars.space.sm}`,
  borderRadius: vars.radius.full,
  border: `1px solid ${vars.color.border}`,
  background: "transparent",
  color: vars.color.textMuted,
  fontSize: vars.fontSize.sm,
  fontFamily: vars.font.body,
  cursor: "pointer",
  ":hover": {
    color: vars.color.text,
  },
  ":focus-visible": {
    outline: `2px solid ${vars.color.accent}`,
    outlineOffset: "1px",
  },
  "@media": {
    [breakpoints.md]: {
      padding: `${vars.space.xs} ${vars.space.sm}`,
    },
  },
});
