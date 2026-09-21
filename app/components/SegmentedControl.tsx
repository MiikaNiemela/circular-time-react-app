import { container, segment, segmentVariants } from "./SegmentedControl.css";

export type TimeView = "day" | "week" | "month" | "year";

const SEGMENTS: { value: TimeView; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

export interface SegmentedControlProps {
  value: TimeView;
  onChange: (value: TimeView) => void;
}

/** Day / Week / Month / Year view switcher. */
export function SegmentedControl({ value, onChange }: SegmentedControlProps) {
  return (
    <div role="group" aria-label="Time view" className={container}>
      {SEGMENTS.map((seg) => {
        const isActive = seg.value === value;
        return (
          <button
            key={seg.value}
            type="button"
            className={`${segment} ${segmentVariants[isActive ? "active" : "inactive"]}`}
            aria-pressed={isActive}
            onClick={() => onChange(seg.value)}
          >
            {seg.label}
          </button>
        );
      })}
    </div>
  );
}
