import type { KeyResult, Objective } from "@/lib/db/schema";

const clamp = (n: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, n));

/**
 * KR progress on a 0–100 scale.
 *   number / percentage / currency → (current − start) / (target − start)
 *   milestone                      → current_value is 0 or 100 directly
 * Non-finite or zero-range KRs collapse to 0 so UI never renders NaN.
 */
export function krProgress(
  kr: Pick<KeyResult, "krType" | "startValue" | "targetValue" | "currentValue">,
): number {
  const start = Number(kr.startValue);
  const target = Number(kr.targetValue);
  const current = Number(kr.currentValue);

  if (kr.krType === "milestone") {
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
  krs: Pick<KeyResult, "krType" | "startValue" | "targetValue" | "currentValue">[],
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
 */
export function pace(opts: {
  actualProgress: number;
  cycleStart: Date;
  cycleEnd: Date;
  now?: Date;
}): { delta: number; expected: number; status: Pace } {
  const now = opts.now ?? new Date();
  const total = opts.cycleEnd.getTime() - opts.cycleStart.getTime();
  if (total <= 0) {
    return { delta: 0, expected: 0, status: "on_pace" };
  }
  const elapsed = now.getTime() - opts.cycleStart.getTime();
  const expected = clamp((elapsed / total) * 100);
  const delta = opts.actualProgress - expected;
  const status: Pace =
    delta >= 0 ? "ahead" : delta >= -15 ? "on_pace" : "behind";
  return { delta, expected, status };
}
