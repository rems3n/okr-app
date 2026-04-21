"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { KrInlineRow } from "@/components/okr/kr-inline-row";
import {
  LevelIcon,
  OwnerChip,
  ProgressBar,
  TeamChip,
} from "@/components/okr/objective-row";
import { PaceStatusPopover } from "@/components/okr/pace-status-popover";
import { useObjective } from "@/hooks/use-objectives";
import type { KeyResult } from "@/lib/db/schema";
import { pace, type Pace } from "@/lib/okr/progress";
import { cn } from "@/lib/utils";

type Cycle = { startDate: string; endDate: string } | null;

export type ExpandableObjectiveRowData = {
  id: string;
  title: string;
  progress: string;
  ownerUserId: string;
  teamId: string | null;
  parentObjectiveId: string | null;
  manualPaceStatus: "ahead" | "on_pace" | "behind" | null;
};

export function ExpandableObjectiveRow({
  objective,
  cycle,
  canEditObjective,
  canEditKrs,
  onSelect,
  ownerName,
  teamName,
  depth = 0,
  treeChevron,
}: {
  objective: ExpandableObjectiveRowData;
  cycle: Cycle;
  canEditObjective: boolean;
  canEditKrs: boolean;
  onSelect?: (id: string) => void;
  ownerName?: string | null;
  teamName?: string | null;
  depth?: number;
  treeChevron?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const derivedStatus: Pace | "no_data" = cycle
    ? pace({
        actualProgress: Number(objective.progress),
        cycleStart: new Date(cycle.startDate),
        cycleEnd: new Date(cycle.endDate),
        override: objective.manualPaceStatus,
      }).status
    : objective.manualPaceStatus ?? "no_data";
  const derivedOnly: Pace | "no_data" = cycle
    ? pace({
        actualProgress: Number(objective.progress),
        cycleStart: new Date(cycle.startDate),
        cycleEnd: new Date(cycle.endDate),
      }).status
    : "no_data";
  const label = `objective-${objective.id}-krs`;

  return (
    <div className="border-b border-zinc-200 dark:border-zinc-800 last:border-b-0">
      <div
        className="flex items-center gap-3 px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900"
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
      >
        {treeChevron}
        <LevelIcon objective={objective} />
        {onSelect ? (
          <button
            type="button"
            onClick={() => onSelect(objective.id)}
            className="flex-1 min-w-0 text-left truncate font-medium hover:underline"
          >
            {objective.title}
          </button>
        ) : (
          <Link
            href={`/objectives/${objective.id}`}
            className="flex-1 min-w-0 text-left truncate font-medium hover:underline"
          >
            {objective.title}
          </Link>
        )}
        <div className="flex items-center gap-3 shrink-0">
          <OwnerChip userId={objective.ownerUserId} ownerName={ownerName} />
          <TeamChip teamId={objective.teamId} teamName={teamName} />
          <PaceStatusPopover
            objectiveId={objective.id}
            derivedStatus={derivedOnly}
            override={objective.manualPaceStatus}
            canEdit={canEditObjective}
          />
          <ProgressBar value={Number(objective.progress)} />
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            aria-expanded={expanded}
            aria-controls={label}
            className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title={expanded ? "Hide key results" : "Show key results"}
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            <span>KRs</span>
          </button>
        </div>
      </div>
      {expanded && (
        <KrsInline
          objectiveId={objective.id}
          canEdit={canEditKrs}
          listId={label}
          derivedStatus={derivedStatus}
        />
      )}
    </div>
  );
}

function KrsInline({
  objectiveId,
  canEdit,
  listId,
  derivedStatus,
}: {
  objectiveId: string;
  canEdit: boolean;
  listId: string;
  derivedStatus: Pace | "no_data";
}) {
  const { detail, isLoading, mutate } = useObjective(objectiveId);
  // Keep a reference so eslint doesn't complain about derivedStatus unused
  void derivedStatus;

  if (isLoading) {
    return (
      <p
        id={listId}
        className="pl-10 pr-3 py-2 text-xs text-zinc-500"
      >
        Loading key results…
      </p>
    );
  }
  if (!detail || detail.keyResults.length === 0) {
    return (
      <p
        id={listId}
        className={cn(
          "pl-10 pr-3 py-2 text-xs",
          detail ? "text-zinc-500" : "text-red-500",
        )}
      >
        {detail ? "No key results on this objective yet." : "Couldn't load key results."}
      </p>
    );
  }

  return (
    <ul id={listId} className="bg-zinc-50/60 dark:bg-zinc-900/40">
      {detail.keyResults.map((kr: KeyResult) => (
        <li key={kr.id}>
          <KrInlineRow
            kr={kr}
            objectiveHref={`/objectives/${objectiveId}`}
            confidence={detail.confidenceByKr[kr.id] ?? "no_data"}
            canEdit={canEdit}
            onMutated={() => mutate()}
          />
        </li>
      ))}
    </ul>
  );
}
