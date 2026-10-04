import type { ReactNode } from "react";
import type { AllDayItem } from "../lib/allDay";
import { archLayout, ARCH_CAPACITY } from "../lib/allDay";
import { KindGlyph, KIND_COLOR, KIND_LABEL } from "./AllDayGlyph";
import { vars } from "../styles/theme.css";

export interface AllDayArchProps {
  items: AllDayItem[];
  capacity?: number;
}

/** Arch geometry in viewBox units, where the circle is 100 wide. */
const VIEW_HEIGHT = 18;
/** The circle starts this far into the arch's box; the two overlap. */
export const ARCH_OVERLAP = 5;
const CIRCLE_CY = VIEW_HEIGHT - ARCH_OVERLAP + 50;
const ICON_RADIUS = 56;
const ICON_SIZE = 4.6;

function position(degrees: number) {
  const rad = (degrees * Math.PI) / 180;
  return { x: 50 + ICON_RADIUS * Math.sin(rad), y: CIRCLE_CY - ICON_RADIUS * Math.cos(rad) };
}

/**
 * The shown day's all-day events as icons on an arch across the top of the
 * circle. Up to `capacity` icons are drawn; beyond that the last becomes "+N".
 * It is as wide as the circle and sits directly above it. Without events it
 * renders an empty, hidden box of the same height, so the layout is stable.
 */
export function AllDayArch({ items, capacity = ARCH_CAPACITY }: AllDayArchProps) {
  if (items.length === 0) {
    // An empty arch still takes its space, so the circle does not move between
    // days with and without all-day events.
    return (
      <svg
        viewBox={`0 0 100 ${VIEW_HEIGHT}`}
        width="100%"
        aria-hidden="true"
        data-all-day-arch="empty"
        style={{ display: "block" }}
      />
    );
  }
  const layout = archLayout(items, capacity);
  const label = "All day: " + items.map((i) => `${i.title} (${KIND_LABEL[i.kind]})`).join(", ");

  return (
    <svg
      viewBox={`0 0 100 ${VIEW_HEIGHT}`}
      width="100%"
      role="img"
      aria-label={label}
      data-all-day-arch="true"
      style={{ display: "block", overflow: "visible" }}
    >
      {layout.shown.map(({ item, degrees }) => {
        const { x, y } = position(degrees);
        return (
          <g
            key={item.key}
            transform={`translate(${x} ${y})`}
            data-kind={item.kind}
            style={{ color: KIND_COLOR[item.kind] }}
          >
            <title>{`${item.title} (${KIND_LABEL[item.kind]})`}</title>
            <circle
              r={ICON_SIZE}
              style={{ fill: vars.color.background }}
              stroke="currentColor"
              strokeWidth={0.5}
            />
            <g transform={`scale(${(ICON_SIZE * 1.15) / 8})`}>
              <KindGlyph kind={item.kind} />
            </g>
          </g>
        );
      })}
      {layout.overflow > 0 && layout.overflowDegrees !== undefined && (
        <g
          transform={`translate(${position(layout.overflowDegrees).x} ${position(layout.overflowDegrees).y})`}
          data-overflow={layout.overflow}
          style={{ color: vars.color.textMuted }}
        >
          <title>{`${layout.overflow} more all-day events`}</title>
          <circle
            r={ICON_SIZE}
            style={{ fill: vars.color.background }}
            stroke="currentColor"
            strokeWidth={0.5}
          />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={3.4}
            style={{ fill: vars.color.text, fontFamily: vars.font.mono }}
          >
            +{layout.overflow}
          </text>
        </g>
      )}
    </svg>
  );
}

/**
 * The arch above a circle: the circle is pulled up so the arch overlaps its
 * top edge. The arch's space is kept even without events, so the circle sits
 * at the same height on every day.
 */
export function CircleWithArch({ items, children }: { items: AllDayItem[]; children: ReactNode }) {
  return (
    <>
      <AllDayArch items={items} />
      <div style={{ marginTop: `-${ARCH_OVERLAP}%` }}>{children}</div>
    </>
  );
}
