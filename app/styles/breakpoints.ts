/** Shared min-width breakpoints for use in vanilla-extract @media keys. */
export const breakpoints = {
  sm: "screen and (min-width: 480px)",
  md: "screen and (min-width: 768px)",
  lg: "screen and (min-width: 1024px)",
} as const;

/**
 * Width queries against the nearest `layoutContainer`, for layouts that
 * follow the space they are given rather than the window (and can be tested
 * at any width in Storybook).
 */
export const containerWidths = {
  md: "(min-width: 768px)",
  lg: "(min-width: 1024px)",
} as const;
