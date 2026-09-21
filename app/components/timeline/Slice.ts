/** Atomic unit of a circular timeline ring. */
export interface Slice {
  /** CSS colour string applied to this arc segment. */
  color: string;
  /** Angular span of this slice, in degrees (0–360). */
  degrees: number;
  /**
   * Opaque id linking this slice back to its source event.
   * Absent on background grid slices and gap/unknown slices.
   * When absent the slice is non-interactive; see `visible` to control opacity.
   */
  eventId?: string;
  /**
   * Short text rendered along the arc curve when the slice spans at least 10°.
   * Absent on gap slices and inner progress-ring slices.
   */
  label?: string;
  /**
   * When true, the slice renders at full opacity even without an `eventId`.
   * Background grid slices set this; event-ring gap slices omit it to stay transparent.
   */
  visible?: boolean;
}

/** Minimum slice span (degrees) required to render an arched label. */
export const MIN_LABEL_DEG = 10;

/**
 * Computes the SVG `d` attribute for a clockwise arc on a circle.
 *
 * Angles are measured clockwise from the top (12 o'clock = 0°).
 * When `degrees` is exactly 360 this function returns `null` — callers must
 * use a full `<circle>` element instead, because an SVG arc whose start and
 * end points coincide renders as nothing.
 */
export function arcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  degrees: number
): string | null {
  if (degrees >= 360) return null;

  const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  const startRad = toRad(startDeg);
  const endRad = toRad(startDeg + degrees);

  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);

  const largeArc = degrees > 180 ? 1 : 0;

  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}
