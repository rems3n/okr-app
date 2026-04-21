import type { KeyResult, Objective } from "@/lib/db/schema";

const clamp = (n: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, n));

/**
 * KR progress on a 0–100 scale.
 *   progressMode = 'manual'        → current_value is the % directly
 *   krType = milestone             → current_value is 0 or 100 directly
 *   number / percentage / currency → (current − start) / (target − start)
 * Non-finite or zero-range KRs collapse to 0 so UI never renders NaN.
 */
export function krProgress(
  kr: Pick<
    KeyResult,
    "krType" | "startValue" | "targetValue" | "currentValue" | "progressMode"
  >,
): number {
  const start = Number(kr.startValue);
  const target = Number(kr.targetValue);
  const current = Number(kr.currentValue);

  if (kr.progressMode === "manual" || kr.krType === "milestone") {
    return clamp(current);
  }

  if (target === start) return 0;
  const pct = ((current - start) / (target - start)) * 100;
  if (!Number.isFinite(pct)) return 0;
  return clamp(pct);
}

/**
 * Objective progress = simple average of its KR progresses.
 * If no KRs, falls back to averaging direct-child objective progress (for
 * objectives that nest rather than hold KRs). Returns 0 when neither exists.
 */
export function objectiveProgress(
  krs: Pick<
    KeyResult,
    "krType" | "startValue" | "targetValue" | "currentValue" | "progressMode"
  >[],
  childObjectives: Pick<Objective, "progress">[] = [],
): number {
  if (krs.length > 0) {
    const avg = krs.reduce((sum, kr) => sum + krProgress(kr), 0) / krs.length;
    return clamp(avg);
  }
  if (childObjectives.length > 0) {
    const avg =
      childObjectives.reduce((sum, o) => sum + Number(o.progress), 0) /
      childObjectives.length;
    return clamp(avg);
  }
  return 0;
}

export type Pace = "ahead" | "on_pace" | "behind";

/**
 * Compares actual progress against time-elapsed in the cycle. A 15pt lag is
 * the "on pace" tolerance; anything beyond that goes yellow.
 *
 * `override` (from objectives.manual_pace_status) short-circuits the derived
 * status but still returns the computed delta/expected so tooltips can show
 * what the override is disagreeing with.
 */
export function pace(opts: {
  actualProgress: number;
  cycleStart: Date;
  cycleEnd: Date;
  now?: Date;
  override?: Pace | null;
}): { delta: number; expected: number; status: Pace; overridden: boolean } {
  const now = opts.now ?? new Date();
  const total = opts.cycleEnd.getTime() - opts.cycleStart.getTime();
  if (total <= 0) {
    const status = opts.override ?? "on_pace";
    return { delta: 0, expected: 0, status, overridden: !!opts.override };
  }
  const elapsed = now.getTime() - opts.cycleStart.getTime();
  const expected = clamp((elapsed / total) * 100);
  const delta = opts.actualProgress - expected;
  const derived: Pace =
    delta >= 0 ? "ahead" : delta >= -15 ? "on_pace" : "behind";
  const status: Pace = opts.override ?? derived;
  return { delta, expected, status, overridden: !!opts.override };
}
