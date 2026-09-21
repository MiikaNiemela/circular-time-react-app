import { style, styleVariants } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css";
import { breakpoints } from "../styles/breakpoints";

export const container = style({
  display: "inline-flex",
  borderRadius: vars.radius.full,
  border: `1px solid ${vars.color.border}`,
  background: vars.color.surface,
  padding: "2px",
  gap: "2px",
});

export const segment = style({
  // 12px vertical padding + ~20px line-height = 44px touch target on mobile.
  padding: `12px ${vars.space.md}`,
  borderRadius: vars.radius.full,
  border: "none",
  background: "transparent",
  color: vars.color.textMuted,
  fontSize: vars.fontSize.sm,
  fontFamily: vars.font.body,
  cursor: "pointer",
  transition: "background 0.15s, color 0.15s",
  whiteSpace: "nowrap",
  ":hover": {
    color: vars.color.text,
  },
  ":focus-visible": {
    outline: `2px solid ${vars.color.accent}`,
    outlineOffset: "1px",
  },
  "@media": {
    [breakpoints.md]: {
      padding: `${vars.space.xs} ${vars.space.md}`,
    },
  },
});

export const segmentVariants = styleVariants({
  active: {
    background: vars.color.accent,
    color: vars.color.onAccent,
    ":hover": {
      color: vars.color.onAccent,
    },
  },
  inactive: {},
});
