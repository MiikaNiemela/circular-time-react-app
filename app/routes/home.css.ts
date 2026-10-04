import { style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css";
import { breakpoints } from "../styles/breakpoints";

// The circle (and the all-day arch above it) fills its column up to 560 px,
// centred. The SVG has a square viewBox, so width drives its size.
export const circleFrame = style({
  width: "min(100%, 560px)",
  marginInline: "auto",
});

export const timeline = style({
  width: "100%",
  height: "auto",
  aspectRatio: "1 / 1",
  display: "block",
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
