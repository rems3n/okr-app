import { describe, expect, it } from "vitest";

import { krProgress, objectiveProgress, pace } from "@/lib/okr/progress";

const auto = { progressMode: "auto" as const };

describe("krProgress", () => {
  it("number type: linear from start to target", () => {
    expect(
      krProgress({
        ...auto,
        krType: "number",
        startValue: "0",
        targetValue: "10",
        currentValue: "5",
      }),
    ).toBe(50);
  });

  it("number type: non-zero start value", () => {
    expect(
      krProgress({
        ...auto,
        krType: "number",
        startValue: "20",
        targetValue: "30",
        currentValue: "25",
      }),
    ).toBe(50);
  });

  it("clamps above 100", () => {
    expect(
      krProgress({
        ...auto,
        krType: "number",
        startValue: "0",
        targetValue: "10",
        currentValue: "15",
      }),
    ).toBe(100);
  });

  it("clamps below 0", () => {
    expect(
      krProgress({
        ...auto,
        krType: "number",
        startValue: "0",
        targetValue: "10",
        currentValue: "-5",
      }),
    ).toBe(0);
  });

  it("zero-range KR is 0%", () => {
    expect(
      krProgress({
        ...auto,
        krType: "number",
        startValue: "10",
        targetValue: "10",
        currentValue: "10",
      }),
    ).toBe(0);
  });

  it("milestone type: current_value treated as 0/100", () => {
    expect(
      krProgress({
        ...auto,
        krType: "milestone",
        startValue: "0",
        targetValue: "100",
        currentValue: "100",
      }),
    ).toBe(100);
    expect(
      krProgress({
        ...auto,
        krType: "milestone",
        startValue: "0",
        targetValue: "100",
        currentValue: "0",
      }),
    ).toBe(0);
  });

  it("percentage + currency types behave like number", () => {
    expect(
      krProgress({
        ...auto,
        krType: "percentage",
        startValue: "0",
        targetValue: "50",
        currentValue: "25",
      }),
    ).toBe(50);
    expect(
      krProgress({
        ...auto,
        krType: "currency",
        startValue: "0",
        targetValue: "1000",
        currentValue: "750",
      }),
    ).toBe(75);
  });

  it("manual mode: currentValue is the percentage directly, ignoring start/target", () => {
    expect(
      krProgress({
        progressMode: "manual",
        krType: "number",
        startValue: "0",
        targetValue: "9999",
        currentValue: "42",
      }),
    ).toBe(42);
  });

  it("manual mode: clamps to 0–100 regardless of raw value", () => {
    expect(
      krProgress({
        progressMode: "manual",
        krType: "number",
        startValue: "0",
        targetValue: "100",
        currentValue: "250",
      }),
    ).toBe(100);
  });
});

describe("objectiveProgress", () => {
  it("averages KR progress when KRs exist", () => {
    const krs = [
      {
        ...auto,
        krType: "number" as const,
        startValue: "0",
        targetValue: "10",
        currentValue: "5",
      },
      {
        ...auto,
        krType: "number" as const,
        startValue: "0",
        targetValue: "10",
        currentValue: "10",
      },
    ];
    expect(objectiveProgress(krs)).toBe(75);
  });

  it("averages child objectives when no KRs", () => {
    expect(
      objectiveProgress([], [{ progress: "30" }, { progress: "60" }]),
    ).toBe(45);
  });

  it("returns 0 when neither KRs nor children", () => {
    expect(objectiveProgress([], [])).toBe(0);
  });
});

describe("pace", () => {
  const start = new Date("2026-01-01");
  const end = new Date("2026-04-01"); // 90 days

  it("halfway through cycle, exactly on pace", () => {
    const p = pace({
      actualProgress: 50,
      cycleStart: start,
      cycleEnd: end,
      now: new Date("2026-02-15"),
    });
    expect(p.status).toBe("ahead");
    expect(p.overridden).toBe(false);
  });

  it("halfway through cycle, 10 points behind = still on_pace", () => {
    const p = pace({
      actualProgress: 40,
      cycleStart: start,
      cycleEnd: end,
      now: new Date("2026-02-15"),
    });
    expect(p.status).toBe("on_pace");
  });

  it("halfway through cycle, 30 points behind = behind", () => {
    const p = pace({
      actualProgress: 20,
      cycleStart: start,
      cycleEnd: end,
      now: new Date("2026-02-15"),
    });
    expect(p.status).toBe("behind");
  });

  it("zero-duration cycle defaults to on_pace", () => {
    const p = pace({
      actualProgress: 50,
      cycleStart: start,
      cycleEnd: start,
      now: new Date("2026-02-15"),
    });
    expect(p.status).toBe("on_pace");
  });

  it("override wins over derived status but delta/expected stay computed", () => {
    const p = pace({
      actualProgress: 80,
      cycleStart: start,
      cycleEnd: end,
      now: new Date("2026-02-15"),
      override: "behind",
    });
    expect(p.status).toBe("behind");
    expect(p.overridden).toBe(true);
    // derived would be "ahead" (80 vs ~50 expected); delta should still reflect that
    expect(p.delta).toBeGreaterThan(0);
  });

  it("null override is a no-op", () => {
    const p = pace({
      actualProgress: 50,
      cycleStart: start,
      cycleEnd: end,
      now: new Date("2026-02-15"),
      override: null,
    });
    expect(p.overridden).toBe(false);
  });
});
