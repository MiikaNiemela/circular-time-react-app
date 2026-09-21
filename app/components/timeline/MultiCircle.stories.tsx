import { expect, fn, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { MultiCircle, type MultiCircleProps, type RingConfig } from ".";
import { slicesForView } from "../../lib/timeSlices";
import { eventRingsForCalendars, type CalendarEvent } from "../../lib/calendarTimeline";
import { useState } from "react";
import { ThemeProvider } from "../ThemeProvider";
import { EventDetail } from "../EventDetail";

/** Event map used by the interactive demo story — keys match the eventId format. */
const CLICK_DEMO_EVENTS = new Map<string, CalendarEvent>([
  [
    "google:g1",
    {
      id: "g1",
      calendarId: "google",
      title: "Focus",
      start: "2026-06-19T09:00:00Z",
      end: "2026-06-19T11:00:00Z",
      color: "#4285f4",
    },
  ],
  [
    "google:g2",
    {
      id: "g2",
      calendarId: "google",
      title: "Lunch",
      start: "2026-06-19T12:00:00Z",
      end: "2026-06-19T13:00:00Z",
      color: "#34a853",
    },
  ],
  [
    "outlook:o1",
    {
      id: "o1",
      calendarId: "outlook",
      title: "Standup",
      start: "2026-06-19T09:30:00Z",
      end: "2026-06-19T10:00:00Z",
      color: "#0078d4",
    },
  ],
  [
    "outlook:o2",
    {
      id: "o2",
      calendarId: "outlook",
      title: "Review",
      start: "2026-06-19T15:00:00Z",
      end: "2026-06-19T16:30:00Z",
      color: "#0078d4",
    },
  ],
]);

/**
 * Two rings with explicit eventId values so the play function can locate and
 * click them by known ring/segment index without depending on computed geometry.
 */
const CLICK_DEMO_RINGS: RingConfig[] = [
  {
    slices: [
      { color: "#4285f4", degrees: 90, eventId: "google:g1" },
      { color: "#e5e7eb", degrees: 270 },
    ],
    lineWidth: 20,
    size: 240,
  },
  {
    slices: [
      { color: "#0078d4", degrees: 45, eventId: "outlook:o1" },
      { color: "#e5e7eb", degrees: 315 },
    ],
    lineWidth: 16,
    size: 160,
  },
];

const meta: Meta<typeof MultiCircle> = {
  title: "Timeline/MultiCircle",
  component: MultiCircle,
  parameters: {
    layout: "centered",
  },
  args: {
    onSliceClick: fn(),
  },
};
export default meta;

type Story = StoryObj<typeof MultiCircle>;

/** Two concentric rings: a day schedule inside a week overview. */
export const DayAndWeek: Story = {
  args: {
    rings: [
      {
        slices: [
          { color: "#6366f1", degrees: 120 }, // 8 h sleep
          { color: "#f59e0b", degrees: 30 }, // 2 h morning
          { color: "#2563eb", degrees: 135 }, // 9 h work
          { color: "#10b981", degrees: 75 }, // 5 h free
        ],
        lineWidth: 24,
        size: 240,
      },
      {
        slices: [
          { color: "#2563eb", degrees: 180 }, // Mon–Wed worked
          { color: "#10b981", degrees: 90 }, // Thu–Fri partial
          { color: "#e5e7eb", degrees: 90 }, // weekend
        ],
        lineWidth: 16,
        size: 160,
      },
    ],
  },
};

/** Three rings: day / week / month. */
export const ThreeRings: Story = {
  args: {
    rings: [
      {
        slices: [
          {
            color: "#6366f1",
            degrees: 120,
          },
          {
            color: "#2563eb",
            degrees: 135,
          },
          {
            color: "#10b981",
            degrees: 75,
          },
          {
            color: "#f59e0b",
            degrees: 30,
          },
        ],

        lineWidth: 25,
        size: 280,
      },
      {
        slices: [
          {
            color: "#2563eb",
            degrees: 200,
          },
          {
            color: "#e5e7eb",
            degrees: 160,
          },
        ],

        lineWidth: 26,
        size: 220,
      },
      {
        slices: [
          {
            color: "#10b981",
            degrees: 360,
          },
        ],

        lineWidth: 2,
        size: 155,
      },
    ],
  },
};

/** A single full-ring — MultiCircle with one ring should behave like Circle. */
export const SingleRing: Story = {
  args: {
    rings: [
      {
        slices: [{ color: "#2563eb", degrees: 360 }],
        lineWidth: 20,
        size: 200,
      },
    ],
  },
};

/**
 * The composed app timeline (Milestone 3.6): background time-grid rings plus one
 * event ring per enabled, authenticated calendar. Here two calendars (Google +
 * Outlook) each contribute a ring of "today" events, nested inside the grid.
 * Clicking an event arc opens the EventDetail overlay; background grid slices
 * have no eventId and log to the Actions panel only.
 */
export const TwoCalendars: Story = {
  decorators: [
    (Story) => (
      <ThemeProvider>
        <div style={{ position: "relative", minHeight: "280px" }}>
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
  render: (args) => <EventDetailPreview {...args} />,
  args: {
    rings: (() => {
      const now = new Date(2026, 5, 19, 10, 30); // Fri 19 Jun 2026, 10:30 local
      // Week window spans Mon 15 Jun – Mon 22 Jun (Mon-anchored).
      const fetchedRange = {
        start: new Date(2026, 5, 15).toISOString(),
        end: new Date(2026, 5, 22).toISOString(),
      };
      const eventRings = eventRingsForCalendars(
        [
          {
            calendarId: "google",
            fetchedRange,
            events: [
              {
                id: "g1",
                calendarId: "google",
                title: "Focus",
                start: "2026-06-19T09:00:00Z",
                end: "2026-06-19T11:00:00Z",
              },
              {
                id: "g2",
                calendarId: "google",
                title: "Lunch",
                start: "2026-06-19T12:00:00Z",
                end: "2026-06-19T13:00:00Z",
              },
            ],
          },
          {
            calendarId: "outlook",
            fetchedRange,
            events: [
              {
                id: "o1",
                calendarId: "outlook",
                title: "Standup",
                start: "2026-06-19T09:30:00Z",
                end: "2026-06-19T10:00:00Z",
              },
              {
                id: "o2",
                calendarId: "outlook",
                title: "Review",
                start: "2026-06-19T15:00:00Z",
                end: "2026-06-19T16:30:00Z",
              },
            ],
          },
        ],
        "week",
        now
      );
      return [...slicesForView("week", now), ...eventRings];
    })(),
  },
};

/**
 * Responsive sizing: with a `className` that sets a fluid width, the square
 * viewBox lets the timeline scale to its container instead of a fixed pixel
 * size. Resize the preview to watch it grow and shrink while staying circular.
 */
export const Responsive: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: "min(70vw, 480px)", resize: "horizontal", overflow: "auto" }}>
        {/* The className wires the svg to fill its container; the route uses a
            clamp()-based width to the same effect. */}
        <style>{".responsive-timeline { width: 100%; height: auto; aspect-ratio: 1 / 1; }"}</style>
        <Story />
      </div>
    ),
  ],
  args: {
    className: "responsive-timeline",
    rings: [
      {
        slices: [
          { color: "#6366f1", degrees: 120 },
          { color: "#2563eb", degrees: 135 },
          { color: "#10b981", degrees: 105 },
        ],
        lineWidth: 24,
        size: 280,
      },
      {
        slices: [
          { color: "#2563eb", degrees: 200 },
          { color: "#e5e7eb", degrees: 160 },
        ],
        lineWidth: 16,
        size: 200,
      },
    ],
  },
};

/** Rings of different thicknesses to verify lineWidth is per-ring. */
export const MixedLineWidths: Story = {
  args: {
    rings: [
      {
        slices: [
          { color: "#2563eb", degrees: 270 },
          { color: "#e5e7eb", degrees: 90 },
        ],
        lineWidth: 32,
        size: 280,
      },
      {
        slices: [
          { color: "#dc2626", degrees: 180 },
          { color: "#f59e0b", degrees: 180 },
        ],
        lineWidth: 8,
        size: 180,
      },
    ],
  },
};

/** Stateful wrapper for the interactive demo — named so React Hook rules are satisfied. */
function EventDetailPreview(props: MultiCircleProps) {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  return (
    <>
      <MultiCircle
        {...props}
        onSliceClick={(slice, sliceIndex, ringIndex) => {
          props.onSliceClick?.(slice, sliceIndex, ringIndex);
          if (slice.eventId) {
            const evt = CLICK_DEMO_EVENTS.get(slice.eventId);
            if (evt) setSelectedEvent(evt);
          }
        }}
      />
      {selectedEvent && (
        <EventDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </>
  );
}

/**
 * Demonstrates the end-to-end click interaction: clicking an event arc opens the
 * `EventDetail` overlay, identical to the behaviour in the home route. The
 * `play` function clicks the Focus arc and asserts the overlay appears, then
 * closes it and asserts it is gone.
 */
export const TwoCalendarsWithEventDetail: Story = {
  decorators: [
    (Story) => (
      <ThemeProvider>
        <div style={{ position: "relative", minHeight: "280px" }}>
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
  render: (args) => <EventDetailPreview {...args} />,
  args: {
    rings: CLICK_DEMO_RINGS,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Ring 1 segment 1 is the Focus event (google:g1); click it to open the overlay.
    await userEvent.click(canvas.getByRole("button", { name: "Ring 1 segment 1" }));
    const dialog = canvas.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("Focus")).toBeInTheDocument();
    // Close and verify the overlay is gone.
    await userEvent.click(canvas.getByRole("button", { name: "Close" }));
    expect(canvas.queryByRole("dialog")).not.toBeInTheDocument();
  },
};
