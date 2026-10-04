import { style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css";
import { containerWidths } from "../styles/breakpoints";

/**
 * The layout follows the width it is given (a container query), not the
 * window: below 1024 px one column in reading order, from 1024 px a header
 * row above the circle and a side panel.
 */
export const layoutContainer = style({
  containerType: "inline-size",
  minHeight: "100dvh",
  background: vars.color.background,
  color: vars.color.text,
  fontFamily: vars.font.body,
});

export const shell = style({
  boxSizing: "border-box",
  maxWidth: "1280px",
  margin: "0 auto",
  padding: vars.space.md,
  display: "flex",
  flexDirection: "column",
  gap: vars.space.md,
  "@container": {
    [containerWidths.lg]: { padding: `${vars.space.md} ${vars.space.lg}`, gap: vars.space.lg },
  },
});

export const header = style({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: vars.space.sm,
  "@container": {
    [containerWidths.lg]: {
      flexWrap: "nowrap",
      gap: vars.space.lg,
      paddingBottom: vars.space.md,
      borderBottom: `1px solid ${vars.color.border}`,
    },
  },
});

export const brand = style({
  order: 1,
  flex: "1 1 auto",
  display: "flex",
  alignItems: "center",
  gap: vars.space.sm,
  fontSize: vars.fontSize.lg,
  fontWeight: 600,
  margin: 0,
  "@container": { [containerWidths.lg]: { flex: "0 0 auto" } },
});

export const actions = style({
  order: 2,
  display: "flex",
  alignItems: "center",
  gap: vars.space.sm,
  "@container": { [containerWidths.lg]: { order: 3 } },
});

export const controls = style({
  order: 3,
  flexBasis: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: vars.space.sm,
  "@container": {
    [containerWidths.lg]: {
      order: 2,
      flex: "1 1 auto",
      flexBasis: "auto",
      flexDirection: "row",
      justifyContent: "space-between",
      gap: vars.space.lg,
    },
  },
});

export const body = style({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: vars.space.lg,
  "@container": {
    [containerWidths.lg]: {
      gridTemplateColumns: "minmax(0, 1fr) minmax(300px, 380px)",
      alignItems: "start",
    },
  },
});

export const circleArea = style({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: vars.space.md,
  minWidth: 0,
});

export const panel = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space.lg,
  minWidth: 0,
});

export const section = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space.sm,
});

export const sectionTitle = style({
  margin: 0,
  fontFamily: vars.font.mono,
  fontSize: "0.75rem",
  fontWeight: 500,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: vars.color.textMuted,
});

export const placeholder = style({
  margin: 0,
  color: vars.color.textMuted,
  fontSize: vars.fontSize.sm,
});
