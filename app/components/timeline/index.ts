/**
 * Public API for the circular timeline component library.
 *
 * Internal helpers (arcPath, ringRadius) are intentionally not exported —
 * they are implementation details subject to change.
 *
 * See docs/decisions/timeline-api.md for the rationale behind this surface.
 */

export type { Slice } from "./Slice";
export { Circle } from "./Circle";
export type { CircleProps } from "./Circle";
export { MultiCircle } from "./MultiCircle";
export type { MultiCircleProps, RingConfig } from "./MultiCircle";
