import type { AllDayKind } from "../data/types";
import { vars } from "../styles/theme.css";

/** Colour role of each kind. */
export const KIND_COLOR: Record<AllDayKind, string> = {
  birthday: vars.color.allDayBirthday,
  "time-off": vars.color.allDayTimeOff,
  other: vars.color.allDayOther,
};

/** Spoken name of each kind. */
export const KIND_LABEL: Record<AllDayKind, string> = {
  birthday: "birthday",
  "time-off": "time off",
  other: "all-day event",
};

/**
 * The glyph for a kind, drawn in a 16 × 16 box centred on the origin, in
 * `currentColor`. Birthday: a gift. Time off: a sun. Other: a flag.
 */
export function KindGlyph({ kind }: { kind: AllDayKind }) {
  const stroke = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (kind) {
    case "birthday":
      return (
        <g {...stroke}>
          <rect x={-4.5} y={-1} width={9} height={6} />
          <rect x={-5.5} y={-3.5} width={11} height={2.5} />
          <path d="M0 -3.5V5 M0 -3.5C-1 -6 -4 -6 -3 -3.5 M0 -3.5C1 -6 4 -6 3 -3.5" />
        </g>
      );
    case "time-off":
      return (
        <g {...stroke}>
          <circle r={2.6} />
          <path d="M0 -6V-4.6 M0 4.6V6 M-6 0H-4.6 M4.6 0H6 M-4.2 -4.2L-3.3 -3.3 M3.3 3.3L4.2 4.2 M-4.2 4.2L-3.3 3.3 M3.3 -3.3L4.2 -4.2" />
        </g>
      );
    case "other":
      return (
        <g {...stroke}>
          <path d="M-3 5.5V-5.5 M-3 -5L4.5 -2.5L-3 0" />
        </g>
      );
  }
}
