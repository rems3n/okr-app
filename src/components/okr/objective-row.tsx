"use client";

import { Building2, ChevronRight, User, Users } from "lucide-react";

import { useMembers } from "@/hooks/use-members";
import { useTeams } from "@/hooks/use-teams";
import type { Objective } from "@/lib/db/schema";
import { type Pace } from "@/lib/okr/progress";
import { cn } from "@/lib/utils";

export function LevelIcon({
  objective,
}: {
  objective: Pick<Objective, "teamId" | "parentObjectiveId">;
}) {
  if (!objective.parentObjectiveId && !objective.teamId) {
    return <Building2 className="h-4 w-4 text-zinc-500" aria-label="Company" />;
  }
  if (objective.teamId) {
    return <Users className="h-4 w-4 text-zinc-500" aria-label="Team" />;
  }
  return <User className="h-4 w-4 text-zinc-500" aria-label="Individual" />;
}

export function ProgressBar({
  value,
  width = "w-24",
}: {
  value: number;
  width?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden",
          width,
        )}
      >
        <div
          className="h-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400 w-10 text-right">
        {pct}%
      </span>
    </div>
  );
}

export function PaceDot({ status }: { status: Pace | "no_data" }) {
  const color =
    status === "ahead" || status === "on_pace"
      ? "bg-emerald-500"
      : status === "behind"
        ? "bg-amber-500"
        : "bg-zinc-300 dark:bg-zinc-700";
  const label =
    status === "ahead"
      ? "Ahead of pace"
      : status === "on_pace"
        ? "On pace"
        : status === "behind"
          ? "Behind pace"
          : "No data";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
      <span className={cn("h-2 w-2 rounded-full", color)} aria-hidden />
      {label}
    </span>
  );
}

export function OwnerChip({
  userId,
  ownerName,
}: {
  userId: string;
  ownerName?: string | null;
}) {
  const { members } = useMembers();
  const name =
    ownerName ?? members.find((m) => m.id === userId)?.name ?? null;
  if (!name) return null;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-zinc-500"
      title={`Owner: ${name}`}
    >
      <User className="h-3 w-3" aria-hidden />
      <span className="max-w-[9rem] truncate">{name}</span>
    </span>
  );
}

export function TeamChip({
  teamId,
  teamName,
}: {
  teamId: string | null;
  teamName?: string | null;
}) {
  const { teams } = useTeams();
  if (!teamId) return null;
  const name = teamName ?? teams.find((t) => t.id === teamId)?.name ?? null;
  if (!name) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border border-zinc-200 dark:border-zinc-700 px-1.5 py-0.5 text-xs text-zinc-500"
      title={`Team: ${name}`}
    >
      {name}
    </span>
  );
}

export function ExpandChevron({
  expanded,
  hasChildren,
  onClick,
}: {
  expanded: boolean;
  hasChildren: boolean;
  onClick: () => void;
}) {
  if (!hasChildren) return <span className="w-4 inline-block" aria-hidden />;
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center h-4 w-4 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
      aria-label={expanded ? "Collapse" : "Expand"}
    >
      <ChevronRight
        className={cn(
          "h-4 w-4 transition-transform",
          expanded ? "rotate-90" : "rotate-0",
        )}
      />
    </button>
  );
}
