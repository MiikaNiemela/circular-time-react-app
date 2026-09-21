import { useId, Fragment } from "react";
import { arcPath, MIN_LABEL_DEG, type Slice } from "./Slice";
import { interactiveSlice } from "./interactiveSlice.css";

/** One ring within a `MultiCircle`. */
export interface RingConfig {
  /** Arc segments that make up this ring. */
  slices: Slice[];
  /** Stroke width of this ring in SVG user units. */
  lineWidth: number;
  /**
   * Outer diameter of this ring in SVG user units.
   * Smaller rings are centred within the largest.
   */
  size: number;
}

export interface MultiCircleProps {
  /** Rings to render, ordered from outermost to innermost (or any order). */
  rings: RingConfig[];
  /**
   * Called when the user clicks (or activates via keyboard) a slice in any ring.
   * Receives the slice data, its zero-based index within its ring's `slices`,
   * and the zero-based index of the ring within `rings`.
   * Only slices that carry an `eventId` are clickable; gap slices are always
   * decorative regardless of whether this prop is provided.
   */
  onSliceClick?: (slice: Slice, sliceIndex: number, ringIndex: number) => void;
  /**
   * Applied to the root `<svg>` so a consumer can size it responsively (the
   * square `viewBox` lets it scale to any width while keeping its 1:1 ratio).
   */
  className?: string;
}

/**
 * Computes the stroke-centre radius for a ring so its stroke stays fully
 * within its declared `size`.
 */
export function ringRadius(size: number, lineWidth: number): number {
  return (size - lineWidth) / 2;
}

/**
 * Renders multiple concentric circular rings in a single SVG.
 *
 * - The SVG viewport equals the diameter of the largest ring (`maxSize`).
 * - Every ring is centred at `(maxSize / 2, maxSize / 2)`.
 * - Arc rendering follows the same rules as `Circle`: clockwise from
 *   12 o'clock, ≥360° → `<circle>`, 0° → skipped.
 * - Each ring has a faint ghost circle (strokeOpacity 0.06) rendered behind its
 *   slices so the ring track is always visible as a layout guide.
 * - Slices without an `eventId` are non-interactive; their opacity defaults to
 *   0 (transparent) unless `slice.visible` is true, in which case they render
 *   at full opacity (used for background time-grid rings).
 * - When `onSliceClick` is provided, slices that have an `eventId` become
 *   keyboard-focusable and activatable with Enter or Space.
 * - When a slice has a `label` and spans at least 10°, the label is rendered
 *   as SVG arched text following the arc curve.
 */
export function MultiCircle({ rings, onSliceClick, className }: MultiCircleProps) {
  const uid = useId();

  if (rings.length === 0) return null;

  const maxSize = Math.max(...rings.map((r) => r.size));
  const cx = maxSize / 2;
  const cy = maxSize / 2;

  const interactive = onSliceClick != null;

  // Pre-compute start angles and arc paths for all rings so <defs> can
  // reference them before the actual slice elements are rendered.
  const ringData = rings.map((ring, ringIndex) => {
    const r = ringRadius(ring.size, ring.lineWidth);
    // Plain loop cursor, not an immutable spread-accumulator: the latter is O(n^2)
    // in slices, and a year ring carries thousands (two per event, plus gaps).
    let cursor = 0;
    const sliceData = ring.slices.map((slice, sliceIndex) => {
      const startDeg = cursor;
      cursor += slice.degrees;
      const d =
        slice.degrees > 0 && slice.degrees < 360
          ? arcPath(cx, cy, r, startDeg, slice.degrees)
          : null;
      return { slice, sliceIndex, d };
    });
    return { ring, ringIndex, r, sliceData };
  });

  return (
    <svg
      className={className}
      width={maxSize}
      height={maxSize}
      viewBox={`0 0 ${maxSize} ${maxSize}`}
      aria-hidden={interactive ? undefined : true}
    >
      <defs>
        {ringData.map(({ ringIndex, sliceData }) =>
          sliceData.map(({ slice, sliceIndex, d }) =>
            d && slice.label && slice.degrees >= MIN_LABEL_DEG ? (
              <path
                key={`${ringIndex}-${sliceIndex}`}
                id={`${uid}r${ringIndex}s${sliceIndex}`}
                d={d}
              />
            ) : null
          )
        )}
      </defs>
      {ringData.map(({ ring, ringIndex, r, sliceData }) => (
        <Fragment key={ringIndex}>
          {/* Ghost ring — faint circle so the ring track is visible even when
              all event slices are absent. */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={ring.lineWidth}
            strokeOpacity={0.06}
            data-ghost="true"
            aria-hidden="true"
          />
          {sliceData.map(({ slice, sliceIndex, d }) => {
            if (slice.degrees <= 0) return null;

            const hasEvent = slice.eventId != null;
            const isSliceInteractive = interactive && hasEvent;
            const fontSize = Math.max(8, ring.lineWidth * 0.55);

            const interactiveProps = isSliceInteractive
              ? {
                  onClick: () => onSliceClick!(slice, sliceIndex, ringIndex),
                  onKeyDown: (e: React.KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ")
                      onSliceClick!(slice, sliceIndex, ringIndex);
                  },
                  role: "button" as const,
                  tabIndex: 0,
                  "aria-label": `Ring ${ringIndex + 1} segment ${sliceIndex + 1}`,
                  className: interactiveSlice,
                  // outline:"none" also set inline so jsdom unit tests can assert it
                  // (CSS class declarations are not applied in the jsdom environment).
                  style: { cursor: "pointer", outline: "none" },
                }
              : {};

            const sharedProps = {
              fill: "none",
              stroke: slice.color,
              strokeWidth: ring.lineWidth,
              // Gap slices (no eventId) are invisible; background grid slices
              // opt in with visible: true to appear at full opacity.
              strokeOpacity: (slice.visible ?? hasEvent) ? 1 : 0,
              ...interactiveProps,
            };

            const key = `${ringIndex}-${sliceIndex}`;
            const labelId = `${uid}r${ringIndex}s${sliceIndex}`;
            const hasLabel = d && slice.label && slice.degrees >= MIN_LABEL_DEG;

            if (hasLabel) {
              return (
                <g key={key}>
                  <path {...sharedProps} d={d!} />
                  <text fontSize={fontSize} fill="white">
                    <textPath href={`#${labelId}`} startOffset="50%" textAnchor="middle">
                      {slice.label}
                    </textPath>
                  </text>
                </g>
              );
            }

            if (slice.degrees >= 360) {
              return <circle key={key} {...sharedProps} cx={cx} cy={cy} r={r} />;
            }

            return d ? <path key={key} {...sharedProps} d={d} /> : null;
          })}
        </Fragment>
      ))}
    </svg>
  );
}
