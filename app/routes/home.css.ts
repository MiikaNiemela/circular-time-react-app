import { style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css";
import { breakpoints } from "../styles/breakpoints";

export const page = style({
  minHeight: "100dvh",
  background: vars.color.background,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  // Tighter gap on narrow screens; the theme lg value is fine for tablet+.
  gap: vars.space.md,
  padding: vars.space.md,
  fontFamily: vars.font.body,
  "@media": {
    [breakpoints.sm]: {
      gap: vars.space.lg,
    },
  },
});

// The timeline SVG has a square viewBox, so width drives the size and the 1:1
// aspect ratio fills in the height. clamp() keeps it within a narrow mobile
// viewport while letting it grow on desktop.
export const timeline = style({
  width: "clamp(240px, 80vw, 360px)",
  maxWidth: "100%",
  height: "auto",
  aspectRatio: "1 / 1",
  "@media": {
    [breakpoints.sm]: {
      width: "clamp(320px, 70vw, 480px)",
    },
    [breakpoints.lg]: {
      width: "clamp(480px, 50vw, 600px)",
    },
  },
});

export const header = style({
  position: "absolute",
  top: vars.space.md,
  right: vars.space.md,
  display: "flex",
  gap: vars.space.sm,
  alignItems: "center",
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
