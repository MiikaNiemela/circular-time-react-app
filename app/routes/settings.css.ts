import { style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css";

export const page = style({
  minHeight: "100dvh",
  background: vars.color.background,
  fontFamily: vars.font.body,
  color: vars.color.text,
});

export const topBar = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: `${vars.space.md} ${vars.space.lg}`,
  borderBottom: `1px solid ${vars.color.border}`,
});

export const backLink = style({
  display: "inline-flex",
  alignItems: "center",
  gap: vars.space.xs,
  color: vars.color.accent,
  fontSize: vars.fontSize.md,
  textDecoration: "none",
  background: "none",
  border: "none",
  cursor: "pointer",
  fontFamily: vars.font.body,
  padding: 0,
  ":hover": {
    color: vars.color.accentHover,
  },
});

export const title = style({
  fontSize: vars.fontSize.lg,
  fontWeight: "600",
  margin: 0,
});

export const content = style({
  maxWidth: "600px",
  margin: "0 auto",
  padding: vars.space.lg,
});

export const sectionTitle = style({
  fontSize: vars.fontSize.sm,
  color: vars.color.textMuted,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: vars.space.sm,
  marginTop: 0,
});

export const calendarList = style({
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: "1px",
  borderRadius: vars.radius.md,
  overflow: "hidden",
  border: `1px solid ${vars.color.border}`,
});

export const calendarItem = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space.md,
  padding: vars.space.md,
  background: vars.color.surface,
  transition: "background 0.15s",
});

export const calendarIcon = style({
  fontSize: "1.5rem",
  lineHeight: 1,
  flexShrink: 0,
});

export const calendarInfo = style({
  flex: 1,
  minWidth: 0,
});

export const calendarName = style({
  fontSize: vars.fontSize.md,
  fontWeight: "500",
  margin: 0,
});

export const calendarStatus = style({
  fontSize: vars.fontSize.sm,
  color: vars.color.textMuted,
  margin: 0,
});

export const calendarActions = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space.sm,
  flexShrink: 0,
});

export const connectButton = style({
  padding: `${vars.space.xs} ${vars.space.sm}`,
  borderRadius: vars.radius.sm,
  border: `1px solid ${vars.color.accent}`,
  background: "transparent",
  color: vars.color.accent,
  fontSize: vars.fontSize.sm,
  fontFamily: vars.font.body,
  cursor: "pointer",
  transition: "background 0.15s, color 0.15s",
  ":hover": {
    background: vars.color.accent,
    color: vars.color.onAccent,
  },
  ":focus-visible": {
    outline: `2px solid ${vars.color.accent}`,
    outlineOffset: "2px",
  },
});

export const disconnectButton = style({
  padding: `${vars.space.xs} ${vars.space.sm}`,
  borderRadius: vars.radius.sm,
  border: `1px solid ${vars.color.border}`,
  background: "transparent",
  color: vars.color.textMuted,
  fontSize: vars.fontSize.sm,
  fontFamily: vars.font.body,
  cursor: "pointer",
  ":hover": {
    borderColor: vars.color.danger,
    color: vars.color.danger,
  },
  ":focus-visible": {
    outline: `2px solid ${vars.color.accent}`,
    outlineOffset: "2px",
  },
});

// Toggle switch
export const toggleLabel = style({
  position: "relative",
  display: "inline-block",
  width: "36px",
  height: "20px",
  flexShrink: 0,
});

export const toggleInput = style({
  opacity: 0,
  width: 0,
  height: 0,
  position: "absolute",
});

export const toggleSlider = style({
  position: "absolute",
  inset: 0,
  borderRadius: vars.radius.full,
  background: vars.color.border,
  transition: "background 0.2s",
  cursor: "pointer",
  "::before": {
    content: '""',
    position: "absolute",
    width: "14px",
    height: "14px",
    left: "3px",
    top: "3px",
    borderRadius: "50%",
    background: vars.color.onAccent,
    transition: "transform 0.2s",
  },
  selectors: {
    "input:checked + &": {
      background: vars.color.accent,
    },
    "input:checked + &::before": {
      transform: "translateX(16px)",
    },
    "input:disabled + &": {
      opacity: 0.4,
      cursor: "not-allowed",
    },
    "input:focus-visible + &": {
      outline: `2px solid ${vars.color.accent}`,
      outlineOffset: "2px",
    },
  },
});
