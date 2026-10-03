/**
 * Tier-2 semantic token layer. `vars` is the contract every styled component
 * references by role (`background`, `text`, `accent`, …); the light and dark
 * themes map those roles onto tier-1 `primitives`, so no raw value is inlined
 * here and the non-colour scales live in exactly one place.
 */

import { createThemeContract, createTheme } from "@vanilla-extract/css";
import { palette, space, fontSize, radius, font } from "./primitives";

export const vars = createThemeContract({
  color: {
    background: null,
    surface: null,
    text: null,
    textMuted: null,
    accent: null,
    accentHover: null,
    border: null,
    /** Foreground colour for text/icons sitting on an `accent` fill. */
    onAccent: null,
    /** Destructive-action colour (e.g. disconnect). */
    danger: null,
    /** Shadow colour for elevated surfaces (cards, overlays). */
    overlayShadow: null,
    /** Marker for the current time on the timeline. */
    now: null,
    /** All-day kinds: icon outline and glyph colours. */
    allDayBirthday: null,
    allDayTimeOff: null,
    allDayOther: null,
  },
  space: {
    xs: null,
    sm: null,
    md: null,
    lg: null,
    xl: null,
  },
  fontSize: {
    sm: null,
    md: null,
    lg: null,
    xl: null,
  },
  radius: {
    sm: null,
    md: null,
    full: null,
  },
  font: {
    body: null,
    mono: null,
  },
});

// The non-colour scales never vary by theme; both themes alias the same
// primitive objects so the raw step values are not duplicated per theme.
const scaleTokens = { space, fontSize, radius, font };

/** Light colour roles; exported so contrast can be tested. */
export const lightColors = {
  background: palette.white,
  surface: palette.gray50,
  text: palette.ink,
  textMuted: palette.gray500,
  accent: palette.blue600,
  accentHover: palette.blue700,
  border: palette.gray200,
  onAccent: palette.white,
  danger: palette.red600,
  overlayShadow: palette.shadowSoft,
  now: palette.red600,
  allDayBirthday: palette.amber700,
  allDayTimeOff: palette.green700,
  allDayOther: palette.blue600,
} as const;

/** Dark colour roles; exported so contrast can be tested. */
export const darkColors = {
  background: palette.ink,
  surface: palette.gray900,
  text: palette.gray50,
  textMuted: palette.gray400,
  accent: palette.blue400,
  accentHover: palette.blue300,
  border: palette.gray700,
  onAccent: palette.white,
  danger: palette.red600,
  overlayShadow: palette.shadowSoft,
  now: palette.red600,
  allDayBirthday: palette.amber500,
  allDayTimeOff: palette.green700,
  allDayOther: palette.blue400,
} as const;

export const lightTheme = createTheme(vars, { color: lightColors, ...scaleTokens });
export const darkTheme = createTheme(vars, { color: darkColors, ...scaleTokens });
