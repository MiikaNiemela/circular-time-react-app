import { useId } from "react";
import { arcPath, MIN_LABEL_DEG, type Slice } from "./Slice";
import { interactiveSlice } from "./interactiveSlice.css";

export interface CircleProps {
  /** Ordered list of arc segments that compose the ring. */
  slices: Slice[];
  /**
   * Stroke width of the ring in SVG user units (pixels when the SVG is
   * rendered at its natural size).
   */
  lineWidth: number;
  /**
   * Outer diameter of the SVG viewport in pixels.
   * @default 200
   */
  size?: number;
  /**
   * Called when the user clicks (or activates via keyboard) a slice.
   * Receives the slice data and its zero-based index within `slices`.
   * Only slices that carry an `eventId` are clickable; gap slices are always
   * decorative regardless of whether this prop is provided.
   */
  onSliceClick?: (slice: Slice, index: number) => void;
}

/**
 * Renders a single circular ring as an SVG composed of coloured arc segments.
 *
 * - Slices are drawn clockwise starting from the top (12 o'clock).
 * - A slice whose `degrees` value is ≥ 360 is rendered as a full `<circle>`
 *   element, which avoids the degenerate SVG arc case where start = end.
 * - Slices with 0 degrees are skipped.
 * - Slices without an `eventId` are rendered transparent (strokeOpacity 0) and
 *   are never focusable or clickable — they exist only to maintain the 360°
 *   ring structure.
 * - When `onSliceClick` is provided, slices that have an `eventId` become
 *   keyboard-focusable and activatable with Enter or Space.
 * - When a slice has a `label` and spans at least 10°, the label is rendered
 *   as SVG arched text following the arc curve.
 */
export function Circle({ slices, lineWidth, size = 200, onSliceClick }: CircleProps) {
  const uid = useId();
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - lineWidth) / 2;
  const fontSize = Math.max(8, lineWidth * 0.55);

  const interactive = onSliceClick != null;

  // Pre-compute start angles and arc paths so <defs> can reference them.
  // reduce accumulates the running cursor without mutating an outer variable.
  const { items: computed } = slices.reduce(
    ({ items, cursor }, slice, i) => ({
      items: [
        ...items,
        {
          slice,
          i,
          d:
            slice.degrees > 0 && slice.degrees < 360
              ? arcPath(cx, cy, r, cursor, slice.degrees)
              : null,
        },
      ],
      cursor: cursor + slice.degrees,
    }),
    { items: [] as Array<{ slice: Slice; i: number; d: string | null }>, cursor: 0 }
  );

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden={interactive ? undefined : true}
    >
      <defs>
        {computed.map(({ slice, d, i }) =>
          d && slice.label && slice.degrees >= MIN_LABEL_DEG ? (
            <path key={i} id={`${uid}a${i}`} d={d} />
          ) : null
        )}
      </defs>
      {computed.map(({ slice, i, d }) => {
        if (slice.degrees <= 0) return null;

        const hasEvent = slice.eventId != null;
        const isSliceInteractive = interactive && hasEvent;

        const interactiveProps = isSliceInteractive
          ? {
              onClick: () => onSliceClick!(slice, i),
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") onSliceClick!(slice, i);
              },
              role: "button" as const,
              tabIndex: 0,
              "aria-label": `Segment ${i + 1}`,
              className: interactiveSlice,
              // outline:"none" also set inline so jsdom unit tests can assert it
              // (CSS class declarations are not applied in the jsdom environment).
              style: { cursor: "pointer", outline: "none" },
            }
          : {};

        const sharedProps = {
          fill: "none",
          stroke: slice.color,
          strokeWidth: lineWidth,
          // Gap slices (no eventId) are invisible but kept in the DOM to
          // preserve the 360° ring geometry.
          strokeOpacity: hasEvent ? 1 : 0,
          ...interactiveProps,
        };

        const hasLabel = d && slice.label && slice.degrees >= MIN_LABEL_DEG;

        if (hasLabel) {
          return (
            <g key={i}>
              <path {...sharedProps} d={d!} />
              <text fontSize={fontSize} fill="white">
                <textPath href={`#${uid}a${i}`} startOffset="50%" textAnchor="middle">
                  {slice.label}
                </textPath>
              </text>
            </g>
          );
        }

        if (slice.degrees >= 360) {
          return <circle key={i} {...sharedProps} cx={cx} cy={cy} r={r} />;
        }

        return d ? <path key={i} {...sharedProps} d={d} /> : null;
      })}
    </svg>
  );
}
