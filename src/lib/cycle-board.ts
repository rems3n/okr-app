import { eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  checkIns,
  cycles,
  keyResults,
  objectives,
  organizations,
  users,
} from "@/lib/db/schema";

type Confidence = "on_track" | "at_risk" | "off_track" | "no_data";

export type BoardKr = {
  id: string;
  title: string;
  krType: string;
  startValue: number;
  targetValue: number;
  currentValue: number;
  unit: string | null;
  ownerName: string;
  confidence: Confidence;
};

export type BoardObjective = {
  id: string;
  title: string;
  description: string | null;
  progress: number;
  ownerName: string;
  parentObjectiveId: string | null;
  keyResults: BoardKr[];
};

export type CycleBoardData = {
  organization: {
    name: string;
  };
  cycle: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    status: string;
  };
  objectives: BoardObjective[];
  generatedAt: string;
};

/**
 * Pure data fetcher for the cycle board view. Used by both the
 * authenticated /cycles/[id]/board page and the unauthenticated
 * /public/cycle/[token] page.
 */
export async function loadCycleBoard(
  organizationId: string,
  cycleId: string,
): Promise<CycleBoardData | null> {
  const [cycle] = await db
    .select()
    .from(cycles)
    .where(eq(cycles.id, cycleId))
    .limit(1);
  if (!cycle || cycle.organizationId !== organizationId) return null;
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  if (!org) return null;

  const objRows = await db
    .select({
      obj: objectives,
      ownerName: users.name,
    })
    .from(objectives)
    .innerJoin(users, eq(users.id, objectives.ownerUserId))
    .where(eq(objectives.cycleId, cycle.id));
  const liveObjs = objRows.filter((r) => !r.obj.deletedAt);
  const objIds = liveObjs.map((r) => r.obj.id);
  if (objIds.length === 0) {
    return {
      organization: { name: org.name },
      cycle: {
        id: cycle.id,
        name: cycle.name,
        startDate: String(cycle.startDate),
        endDate: String(cycle.endDate),
        status: cycle.status,
      },
      objectives: [],
      generatedAt: new Date().toISOString(),
    };
  }

  const krRows = await db
    .select({
      kr: keyResults,
      ownerName: users.name,
    })
    .from(keyResults)
    .innerJoin(users, eq(users.id, keyResults.ownerUserId))
    .where(inArray(keyResults.objectiveId, objIds));
  const liveKrs = krRows.filter((r) => !r.kr.deletedAt);
  const krIds = liveKrs.map((r) => r.kr.id);

  const checkInRows =
    krIds.length === 0
      ? []
      : await db
          .select({
            keyResultId: checkIns.keyResultId,
            confidence: checkIns.confidence,
            createdAt: checkIns.createdAt,
          })
          .from(checkIns)
          .where(inArray(checkIns.keyResultId, krIds));
  const latestByKr = new Map<string, Confidence>();
  const latestAtByKr = new Map<string, Date>();
  for (const r of checkInRows) {
    const prev = latestAtByKr.get(r.keyResultId);
    if (!prev || r.createdAt > prev) {
      latestAtByKr.set(r.keyResultId, r.createdAt);
      latestByKr.set(r.keyResultId, r.confidence as Confidence);
    }
  }

  const krsByObj = new Map<string, BoardKr[]>();
  for (const r of liveKrs) {
    const list = krsByObj.get(r.kr.objectiveId) ?? [];
    list.push({
      id: r.kr.id,
      title: r.kr.title,
      krType: r.kr.krType,
      startValue: Number(r.kr.startValue),
      targetValue: Number(r.kr.targetValue),
      currentValue: Number(r.kr.currentValue),
      unit: r.kr.unit ?? null,
      ownerName: r.ownerName,
      confidence: (latestByKr.get(r.kr.id) ?? "no_data") as Confidence,
    });
    krsByObj.set(r.kr.objectiveId, list);
  }

  const objectivesOut: BoardObjective[] = liveObjs.map((r) => ({
    id: r.obj.id,
    title: r.obj.title,
    description: r.obj.description,
    progress: Number(r.obj.progress),
    ownerName: r.ownerName,
    parentObjectiveId: r.obj.parentObjectiveId,
    keyResults: krsByObj.get(r.obj.id) ?? [],
  }));

  return {
    organization: { name: org.name },
    cycle: {
      id: cycle.id,
      name: cycle.name,
      startDate: String(cycle.startDate),
      endDate: String(cycle.endDate),
      status: cycle.status,
    },
    objectives: objectivesOut,
    generatedAt: new Date().toISOString(),
  };
}
