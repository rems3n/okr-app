"use client";

import { useMemo, useState } from "react";

import { ExpandableObjectiveRow } from "@/components/okr/expandable-objective-row";
import { ExpandChevron } from "@/components/okr/objective-row";
import { can, type Role } from "@/lib/auth/permissions";
import type { Cycle, Objective } from "@/lib/db/schema";

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
  currentUserId,
  currentRole,
}: {
  objectives: Objective[];
  cycle: Cycle | null;
  currentUserId: string;
  currentRole: Role;
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
      <ul>
        {tree.map((node) => (
          <TreeRow
            key={node.id}
            node={node}
            depth={0}
            cycle={cycle}
            expanded={expanded}
            setExpanded={setExpanded}
            currentUserId={currentUserId}
            currentRole={currentRole}
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
  currentUserId,
  currentRole,
}: {
  node: Node;
  depth: number;
  cycle: Cycle | null;
  expanded: Record<string, boolean>;
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  currentUserId: string;
  currentRole: Role;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded[node.id] ?? false;
  const isAdmin = can(currentRole, "team.manage");
  const isOwner = node.ownerUserId === currentUserId;

  return (
    <li>
      <ExpandableObjectiveRow
        objective={node}
        cycle={cycle}
        canEditObjective={isOwner || isAdmin}
        canEditKrs={isAdmin || isOwner}
        depth={depth}
        treeChevron={
          <ExpandChevron
            expanded={isExpanded}
            hasChildren={hasChildren}
            onClick={() =>
              setExpanded((prev) => ({ ...prev, [node.id]: !isExpanded }))
            }
          />
        }
      />
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
              currentUserId={currentUserId}
              currentRole={currentRole}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
