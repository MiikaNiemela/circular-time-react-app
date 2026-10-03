import { style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css";
import { containerWidths } from "../styles/breakpoints";

export const list = style({ listStyle: "none", margin: 0, padding: 0 });

/**
 * On narrow layouts only upcoming events show until the list is expanded.
 * The wide layout always shows the full day.
 */
export const collapsed = style({});

export const row = style({
  selectors: {
    [`${collapsed} &[data-past="true"]`]: { display: "none" },
  },
  "@container": {
    [containerWidths.lg]: {
      selectors: { [`${collapsed} &[data-past="true"]`]: { display: "block" } },
    },
  },
});

export const button = style({
  width: "100%",
  display: "grid",
  gridTemplateColumns: "auto auto 1fr auto",
  alignItems: "center",
  gap: vars.space.sm,
  padding: `${vars.space.sm} 0`,
  border: "none",
  borderBottom: `1px solid ${vars.color.border}`,
  background: "none",
  color: vars.color.text,
  font: "inherit",
  textAlign: "left",
  cursor: "pointer",
  ":focus-visible": { outline: `2px solid ${vars.color.accent}`, outlineOffset: "2px" },
  selectors: {
    '[data-past="true"] > &': { color: vars.color.textMuted },
  },
});

export const time = style({
  fontFamily: vars.font.mono,
  fontSize: vars.fontSize.sm,
  color: vars.color.textMuted,
  fontVariantNumeric: "tabular-nums",
});

export const dot = style({ width: "10px", height: "10px", borderRadius: vars.radius.full });

export const title = style({ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" });

export const meta = style({
  fontSize: "0.75rem",
  color: vars.color.textMuted,
  textAlign: "right",
});

export const upNext = style({
  fontFamily: vars.font.mono,
  fontSize: "0.7rem",
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: vars.color.accent,
  marginRight: vars.space.xs,
});

export const empty = style({ margin: 0, color: vars.color.textMuted, fontSize: vars.fontSize.sm });

export const toggle = style({
  alignSelf: "flex-start",
  border: "none",
  background: "none",
  padding: `${vars.space.xs} 0`,
  color: vars.color.accent,
  font: "inherit",
  fontSize: vars.fontSize.sm,
  cursor: "pointer",
  "@container": { [containerWidths.lg]: { display: "none" } },
});
