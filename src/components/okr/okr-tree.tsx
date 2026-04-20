"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  ExpandChevron,
  LevelIcon,
  PaceDot,
  ProgressBar,
} from "@/components/okr/objective-row";
import type { Cycle, Objective } from "@/lib/db/schema";
import { pace, type Pace } from "@/lib/okr/progress";

type Node = Objective & { children: Node[] };

function buildTree(items: Objective[]): Node[] {
  const byId = new Map<string, Node>();
  items.forEach((o) => byId.set(o.id, { ...o, children: [] }));
  const roots: Node[] = [];
  byId.forEach((n) => {
    if (n.parentObjectiveId && byId.has(n.parentObjectiveId)) {
      byId.get(n.parentObjectiveId)!.children.push(n);
    } else {
      roots.push(n);
    }
  });
  return roots;
}

export function OkrTree({
  objectives,
  cycle,
  onSelect,
}: {
  objectives: Objective[];
  cycle: Cycle | null;
  onSelect?: (objective: Objective) => void;
}) {
  const tree = useMemo(() => buildTree(objectives), [objectives]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    objectives.forEach((o) => {
      if (!o.parentObjectiveId) init[o.id] = true;
    });
    return init;
  });

  if (tree.length === 0) {
    return (
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 text-sm text-zinc-500">
        No objectives match the current filters.
      </div>
    );
  }

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 overflow-hidden">
      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {tree.map((node) => (
          <TreeRow
            key={node.id}
            node={node}
            depth={0}
            cycle={cycle}
            expanded={expanded}
            setExpanded={setExpanded}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </div>
  );
}

function TreeRow({
  node,
  depth,
  cycle,
  expanded,
  setExpanded,
  onSelect,
}: {
  node: Node;
  depth: number;
  cycle: Cycle | null;
  expanded: Record<string, boolean>;
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onSelect?: (o: Objective) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded[node.id] ?? false;
  const paceStatus: Pace | "no_data" = cycle
    ? pace({
        actualProgress: Number(node.progress),
        cycleStart: new Date(cycle.startDate),
        cycleEnd: new Date(cycle.endDate),
      }).status
    : "no_data";

  const handleClick = () => {
    if (onSelect) onSelect(node);
  };

  return (
    <li>
      <div
        className="flex items-center gap-3 px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900"
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
      >
        <ExpandChevron
          expanded={isExpanded}
          hasChildren={hasChildren}
          onClick={() =>
            setExpanded((prev) => ({ ...prev, [node.id]: !isExpanded }))
          }
        />
        <LevelIcon objective={node} />
        {onSelect ? (
          <button
            type="button"
            onClick={handleClick}
            className="flex-1 text-left truncate font-medium hover:underline"
          >
            {node.title}
          </button>
        ) : (
          <Link
            href={`/objectives/${node.id}`}
            className="flex-1 text-left truncate font-medium hover:underline"
          >
            {node.title}
          </Link>
        )}
        <div className="flex items-center gap-4 shrink-0">
          <PaceDot status={paceStatus} />
          <ProgressBar value={Number(node.progress)} />
        </div>
      </div>
      {isExpanded && hasChildren && (
        <ul>
          {node.children.map((child) => (
            <TreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              cycle={cycle}
              expanded={expanded}
              setExpanded={setExpanded}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
