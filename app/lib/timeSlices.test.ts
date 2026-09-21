import { describe, it, expect } from "vitest";
import { slicesForView } from "./timeSlices";

// A fixed reference date: Thursday 2026-06-19, 14:30
const REF = new Date(2026, 5, 19, 14, 30, 0); // month is 0-based

function totalDegrees(rings: ReturnType<typeof slicesForView>) {
  return rings.map((r) => r.slices.reduce((s, sl) => s + sl.degrees, 0));
}

// ---------------------------------------------------------------------------
// Default mode — neutral colours, labels, configurable sizing
// ---------------------------------------------------------------------------
describe("slicesForView (default mode)", () => {
  describe("day view", () => {
    const rings = slicesForView("day", REF);

    it("returns two rings", () => expect(rings.length).toBe(2));
    it("outer ring has 24 slices", () => expect(rings[0].slices.length).toBe(24));

    it("all outer slices share the neutral colour", () => {
      rings[0].slices.forEach((s) => expect(s.color).toBe("#e5e7eb"));
    });

    it("outer ring totals 360°", () => {
      expect(rings[0].slices.reduce((s, sl) => s + sl.degrees, 0)).toBeCloseTo(360);
    });

    it("inner ring totals 360°", () => {
      expect(rings[1].slices.reduce((s, sl) => s + sl.degrees, 0)).toBeCloseTo(360);
    });

    it("outer slices carry hour labels '0'–'23'", () => {
      expect(rings[0].slices[0].label).toBe("0");
      expect(rings[0].slices[14].label).toBe("14");
      expect(rings[0].slices[23].label).toBe("23");
    });

    it("inner (progress) slices have no label", () => {
      rings[1].slices.forEach((s) => expect(s.label).toBeUndefined());
    });
  });

  describe("week view", () => {
    const rings = slicesForView("week", REF);

    it("outer ring has 7 slices", () => expect(rings[0].slices.length).toBe(7));

    it("all outer slices share the neutral colour", () => {
      rings[0].slices.forEach((s) => expect(s.color).toBe("#e5e7eb"));
    });

    it("outer slices carry day labels", () => {
      expect(rings[0].slices[0].label).toBe("Mon");
      expect(rings[0].slices[4].label).toBe("Fri");
      expect(rings[0].slices[6].label).toBe("Sun");
    });

    it("all rings total 360°", () => {
      totalDegrees(rings).forEach((d) => expect(d).toBeCloseTo(360));
    });
  });

  describe("month view", () => {
    const rings = slicesForView("month", REF);

    it("outer ring has 30 slices (June has 30 days)", () => {
      expect(rings[0].slices.length).toBe(30);
    });

    it("all outer slices share the neutral colour", () => {
      rings[0].slices.forEach((s) => expect(s.color).toBe("#e5e7eb"));
    });

    it("outer slices carry day-number labels", () => {
      expect(rings[0].slices[0].label).toBe("1");
      expect(rings[0].slices[18].label).toBe("19");
    });

    it("all rings total 360°", () => {
      totalDegrees(rings).forEach((d) => expect(d).toBeCloseTo(360));
    });
  });

  describe("year view", () => {
    const rings = slicesForView("year", REF);

    it("outer ring has 12 slices", () => expect(rings[0].slices.length).toBe(12));

    it("all outer slices share the neutral colour", () => {
      rings[0].slices.forEach((s) => expect(s.color).toBe("#e5e7eb"));
    });

    it("outer slices carry month abbreviation labels", () => {
      expect(rings[0].slices[0].label).toBe("Jan");
      expect(rings[0].slices[5].label).toBe("Jun");
      expect(rings[0].slices[11].label).toBe("Dec");
    });

    it("months are proportional (Feb < Jan)", () => {
      expect(rings[0].slices[1].degrees).toBeLessThan(rings[0].slices[0].degrees);
    });

    it("all rings total 360°", () => {
      totalDegrees(rings).forEach((d) => expect(d).toBeCloseTo(360));
    });
  });

  it("each view produces a different outer ring slice count", () => {
    const counts = (["day", "week", "month", "year"] as const).map(
      (v) => slicesForView(v, REF)[0].slices.length
    );
    expect(new Set(counts).size).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Temporal mode — past/current/future colour coding
// ---------------------------------------------------------------------------
describe("slicesForView (temporalColors: true)", () => {
  describe("day view", () => {
    const rings = slicesForView("day", REF, { temporalColors: true });

    it("14 hours are marked past (hours 0–13)", () => {
      const past = rings[0].slices.filter((s) => s.color === "#2563eb");
      expect(past.length).toBe(14);
    });

    it("current hour (14) is marked with light blue", () => {
      expect(rings[0].slices[14].color).toBe("#60a5fa");
    });
  });

  describe("week view", () => {
    const rings = slicesForView("week", REF, { temporalColors: true });
    // 2026-06-19 is Friday → dayOfWeek = 4 (Mon=0)

    it("4 days are past (Mon–Thu)", () => {
      expect(rings[0].slices.filter((s) => s.color === "#2563eb").length).toBe(4);
    });

    it("Friday (index 4) is current", () => {
      expect(rings[0].slices[4].color).toBe("#60a5fa");
    });
  });

  describe("month view", () => {
    const rings = slicesForView("month", REF, { temporalColors: true });
    // June 2026: 30 days; today = 19th

    it("18 days are past (days 1–18)", () => {
      expect(rings[0].slices.filter((s) => s.color === "#2563eb").length).toBe(18);
    });

    it("day 19 (index 18) is current", () => {
      expect(rings[0].slices[18].color).toBe("#60a5fa");
    });
  });

  describe("year view", () => {
    const rings = slicesForView("year", REF, { temporalColors: true });
    // June = month index 5

    it("5 months are past (Jan–May)", () => {
      expect(rings[0].slices.filter((s) => s.color === "#2563eb").length).toBe(5);
    });

    it("June (index 5) is current", () => {
      expect(rings[0].slices[5].color).toBe("#60a5fa");
    });
  });
});

// ---------------------------------------------------------------------------
// Configurable ring sizing
// ---------------------------------------------------------------------------
describe("slicesForView (custom sizing)", () => {
  it("respects outerLineWidth and outerSize options", () => {
    const rings = slicesForView("day", REF, { outerLineWidth: 10, outerSize: 160 });
    expect(rings[0].lineWidth).toBe(10);
    expect(rings[0].size).toBe(160);
  });

  it("respects innerLineWidth and innerSize options", () => {
    const rings = slicesForView("day", REF, { innerLineWidth: 8, innerSize: 100 });
    expect(rings[1].lineWidth).toBe(8);
    expect(rings[1].size).toBe(100);
  });
});
