import { style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css";
import { breakpoints } from "../styles/breakpoints";

// The timeline SVG has a square viewBox, so width drives the size and the 1:1
// aspect ratio fills in the height. It fills its column up to 560 px, centred.
export const timeline = style({
  width: "min(100%, 560px)",
  height: "auto",
  aspectRatio: "1 / 1",
  display: "block",
});

export const emptyState = style({
  textAlign: "center",
  color: vars.color.textMuted,
  fontSize: vars.fontSize.sm,
  margin: 0,
});

export const emptyStateLink = style({
  color: vars.color.accent,
  textDecoration: "none",
  ":hover": {
    textDecoration: "underline",
  },
});

export const timeLapseToggle = style({
  display: "inline-flex",
  alignItems: "center",
  gap: vars.space.xs,
  color: vars.color.textMuted,
  fontSize: vars.fontSize.sm,
  cursor: "pointer",
  userSelect: "none",
  margin: 0,
});

export const settingsLink = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  // 44px touch target on mobile; 32px on larger screens where pointer is precise.
  width: "44px",
  height: "44px",
  borderRadius: vars.radius.full,
  border: `1px solid ${vars.color.border}`,
  background: vars.color.surface,
  color: vars.color.textMuted,
  fontSize: vars.fontSize.md,
  textDecoration: "none",
  transition: "color 0.15s, border-color 0.15s",
  ":hover": {
    color: vars.color.text,
    borderColor: vars.color.text,
  },
  "@media": {
    [breakpoints.md]: {
      width: "32px",
      height: "32px",
    },
  },
});
