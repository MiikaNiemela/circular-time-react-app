# Timeline component public API

Resolves the open questions tracked in [issue #2](https://github.com/MiikaNiemela/circular-time-app/issues/2) before calendar data is wired in Milestone 3.

## Decisions

### 1. Flat array vs named schedules with event metadata

**Decision:** keep the flat `RingConfig[]` array.

`Circle` and `MultiCircle` are pure presentational components. They receive pre-computed `color` and `degrees` values and have no knowledge of calendars, events, or schedules. Attaching calendar identity or event metadata to the slice model would couple the visual core to the data layer and make future extraction harder.

Named schedules and event metadata belong in the mapping layer (Milestone 3.2, *Event → slice mapping*), which translates calendar events into `Slice[]` arrays before handing them to the component. The component API therefore stays:

```ts
// Atomic unit — color + angular span only
interface Slice { color: string; degrees: number; }

// One ring in a MultiCircle
interface RingConfig { slices: Slice[]; lineWidth: number; size: number; }
```

### 2. `onSliceClick` interactivity

**Decision:** implemented in Milestone 1.4.

`onSliceClick` is an optional prop on both `Circle` and `MultiCircle`. When provided, each arc element gains `role="button"`, `tabIndex={0}`, and responds to click and Enter/Space key events — making slices accessible without requiring a mouse.

Signatures:

```ts
// Circle
onSliceClick?: (slice: Slice, index: number) => void

// MultiCircle — ringIndex lets callers identify which schedule was tapped
onSliceClick?: (slice: Slice, sliceIndex: number, ringIndex: number) => void
```

When the prop is absent, no interactive attributes are added and the component is purely presentational.

### 3. Single `index.ts` entry point

**Decision:** yes. All consumer-facing types and components are exported from `app/components/timeline/index.ts`. Internal helpers (`arcPath`, `ringRadius`) are not re-exported — they are implementation details that may change without notice.

**Public surface:**

| Export          | Kind      | Description                              |
|-----------------|-----------|------------------------------------------|
| `Slice`         | interface | Atomic arc segment (color + degrees)     |
| `CircleProps`   | interface | Props for `Circle`                       |
| `Circle`        | component | Single concentric ring as SVG            |
| `RingConfig`    | interface | One ring within a `MultiCircle`          |
| `MultiCircleProps` | interface | Props for `MultiCircle`               |
| `MultiCircle`   | component | Multiple concentric rings in one SVG     |
