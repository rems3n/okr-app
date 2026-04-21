"use client";

import {
  CheckCircle2,
  MessageSquare,
  Star,
} from "lucide-react";
import Link from "next/link";
import useSWR from "swr";

import { apiGet } from "@/lib/api/client";

type ActivityEvent = {
  id: string;
  type: "check_in" | "comment" | "score";
  createdAt: string;
  actorName: string;
  objectiveId: string;
  objectiveTitle: string;
  keyResultId: string | null;
  keyResultTitle: string | null;
  summary: string;
};

const ICON = {
  check_in: CheckCircle2,
  comment: MessageSquare,
  score: Star,
};

const COLOR = {
  check_in: "text-emerald-600",
  comment: "text-blue-600",
  score: "text-violet-600",
};

export function ActivityFeed({ cycleId }: { cycleId: string }) {
  const { data: events = [], isLoading } = useSWR<ActivityEvent[]>(
    `/api/v1/dashboard/activity?cycleId=${cycleId}`,
    apiGet,
  );
  if (isLoading) return null;
  if (events.length === 0) return null;
  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Recent activity</h2>
      <ol className="border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 divide-y divide-zinc-200 dark:divide-zinc-800">
        {events.map((e) => {
          const Icon = ICON[e.type];
          const colorCls = COLOR[e.type];
          return (
            <li key={e.id}>
              <Link
                href={`/objectives/${e.objectiveId}`}
                className="flex items-start gap-3 px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${colorCls}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium">{e.actorName}</span>{" "}
                    <span className="text-zinc-600 dark:text-zinc-400">
                      {e.summary}
                    </span>
                  </p>
                  <p className="text-xs text-zinc-500 truncate">
                    {e.keyResultTitle
                      ? `${e.keyResultTitle} · ${e.objectiveTitle}`
                      : e.objectiveTitle}
                    {" · "}
                    {new Date(e.createdAt).toLocaleString()}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
