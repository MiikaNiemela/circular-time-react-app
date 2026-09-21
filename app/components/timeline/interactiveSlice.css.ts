/**
 * Shared visual class for interactive SVG arc elements (path and circle).
 * Uses filter-based effects because CSS outline on SVG paths draws a
 * rectangular bounding box, not an arc-shaped indicator.
 *
 * Focus colours are intentionally hard-coded rather than aliased from the app's
 * semantic tokens: the timeline package must import no app-level module to stay
 * extraction-ready (roadmap M1.5). On extraction it ships its own token contract.
 */
import { style } from "@vanilla-extract/css";

/** CSS class for the arc-shaped focus ring and hover feedback on interactive SVG slice elements. */
export const interactiveSlice = style({
  outline: "none",
  ":hover": {
    filter: "brightness(1.15)",
  },
  ":focus-visible": {
    // drop-shadow() follows actual painted pixels, not the bounding box.
    filter: "drop-shadow(0 0 3px #3b82f6) drop-shadow(0 0 7px rgba(59, 130, 246, 0.5))",
  },
});
