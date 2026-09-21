/**
 * Tier-1 design primitives: the raw, theme-agnostic source of truth for every
 * colour, spacing step, type size, and radius in the app. Semantic tokens
 * (`theme.css.ts`) alias these — nothing else should hard-code a raw value.
 *
 * Primitives are plain constants rather than CSS variables because some
 * consumers take a colour as data, not as a style property: the timeline's SVG
 * slice colours (`eventSlices.ts`, `timeSlices.ts`) are passed into the
 * presentational component as strings and must resolve to a literal at the data
 * layer, where no theme class is in scope.
 */

/**
 * The full colour palette. Names encode hue + a numeric weight (higher = darker
 * for greys/blues), so semantic aliases can be re-pointed without renaming.
 */
export const palette = {
  white: "#ffffff",
  // Greys, light → dark.
  gray50: "#f5f5f5",
  gray200: "#e5e7eb",
  gray300: "#d1d5db",
  gray400: "#999999",
  gray500: "#666666",
  gray700: "#374151",
  gray900: "#1e1e1e",
  ink: "#111111",
  // Blues, dark → light (accent + temporal grid).
  blue700: "#1d4ed8",
  blue600: "#2563eb",
  blue400: "#60a5fa",
  blue300: "#93c5fd",
  amber500: "#f59e0b",
  red600: "#dc2626",
  /** Translucent black for elevation shadows. */
  shadowSoft: "rgba(0, 0, 0, 0.12)",
} as const;

/** Spacing scale in pixels, used for padding, margins, and gaps. */
export const space = {
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "32px",
  xl: "64px",
} as const;

/** Type scale in rem. */
export const fontSize = {
  sm: "0.875rem",
  md: "1rem",
  lg: "1.25rem",
  xl: "1.5rem",
} as const;

/** Corner-radius scale; `full` is the pill/circle sentinel. */
export const radius = {
  sm: "4px",
  md: "8px",
  full: "9999px",
} as const;

/** Font-family stack. */
export const font = {
  body: "system-ui, sans-serif",
} as const;
