"use client";

import { Command } from "cmdk";
import { Building2, Calendar, Search, Target, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR from "swr";

import { apiGet } from "@/lib/api/client";

type SearchResult = {
  objectives: Array<{
    id: string;
    title: string;
    cycleId: string;
    cycleName: string;
  }>;
  keyResults: Array<{
    id: string;
    title: string;
    objectiveId: string;
    objectiveTitle: string;
  }>;
  cycles: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string; email: string }>;
};

const EMPTY: SearchResult = {
  objectives: [],
  keyResults: [],
  cycles: [],
  users: [],
};

export function SearchPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const trimmed = query.trim();
  const { data, isLoading } = useSWR<SearchResult>(
    open && trimmed.length >= 2
      ? `/api/v1/search?q=${encodeURIComponent(trimmed)}`
      : null,
    apiGet,
    { keepPreviousData: true },
  );
  const results = data ?? EMPTY;

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden sm:inline-flex items-center gap-2 rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900"
        title="Search (Cmd+K)"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Search…</span>
        <kbd className="font-sans text-[10px] text-zinc-400 border border-zinc-200 dark:border-zinc-700 rounded px-1">
          ⌘K
        </kbd>
      </button>
    );
  }

  const total =
    results.objectives.length +
    results.keyResults.length +
    results.cycles.length +
    results.users.length;
  const showingEmpty = trimmed.length >= 2 && !isLoading && total === 0;
  const showingPrompt = trimmed.length < 2;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-24 px-4"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl overflow-hidden"
      >
        <Command shouldFilter={false} loop>
          <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800 px-3">
            <Search className="h-4 w-4 text-zinc-400 shrink-0" />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Search objectives, KRs, people, cycles…"
              className="flex-1 bg-transparent px-2 py-3 text-sm outline-none placeholder:text-zinc-400"
            />
            <kbd className="font-sans text-[10px] text-zinc-400 border border-zinc-200 dark:border-zinc-700 rounded px-1 py-0.5">
              esc
            </kbd>
          </div>
          <Command.List className="max-h-[60vh] overflow-y-auto py-2">
            {showingPrompt && (
              <Command.Empty className="px-4 py-6 text-center text-xs text-zinc-500">
                Type at least 2 characters.
              </Command.Empty>
            )}
            {showingEmpty && (
              <Command.Empty className="px-4 py-6 text-center text-xs text-zinc-500">
                Nothing found for “{trimmed}”.
              </Command.Empty>
            )}
            {isLoading && !data && (
              <div className="px-4 py-3 text-xs text-zinc-500">
                Searching…
              </div>
            )}
            {results.objectives.length > 0 && (
              <Command.Group
                heading="Objectives"
                className="text-[10px] uppercase tracking-wider text-zinc-400 px-3 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1"
              >
                {results.objectives.map((o) => (
                  <Command.Item
                    key={o.id}
                    value={`obj-${o.id}-${o.title}`}
                    onSelect={() => go(`/objectives/${o.id}`)}
                    className="flex items-center gap-3 px-3 py-2 text-sm rounded-md cursor-pointer data-[selected=true]:bg-zinc-100 dark:data-[selected=true]:bg-zinc-800"
                  >
                    <Target className="h-4 w-4 text-zinc-500 shrink-0" />
                    <span className="flex-1 truncate">{o.title}</span>
                    <span className="text-xs text-zinc-400 shrink-0">
                      {o.cycleName}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
            {results.keyResults.length > 0 && (
              <Command.Group
                heading="Key results"
                className="text-[10px] uppercase tracking-wider text-zinc-400 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1"
              >
                {results.keyResults.map((kr) => (
                  <Command.Item
                    key={kr.id}
                    value={`kr-${kr.id}-${kr.title}`}
                    onSelect={() => go(`/objectives/${kr.objectiveId}`)}
                    className="flex items-center gap-3 px-3 py-2 text-sm rounded-md cursor-pointer data-[selected=true]:bg-zinc-100 dark:data-[selected=true]:bg-zinc-800"
                  >
                    <Building2 className="h-4 w-4 text-zinc-500 shrink-0" />
                    <span className="flex-1 truncate">{kr.title}</span>
                    <span className="text-xs text-zinc-400 shrink-0 truncate max-w-[10rem]">
                      {kr.objectiveTitle}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
            {results.cycles.length > 0 && (
              <Command.Group
                heading="Cycles"
                className="text-[10px] uppercase tracking-wider text-zinc-400 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1"
              >
                {results.cycles.map((c) => (
                  <Command.Item
                    key={c.id}
                    value={`cycle-${c.id}-${c.name}`}
                    onSelect={() => go(`/objectives?cycleId=${c.id}`)}
                    className="flex items-center gap-3 px-3 py-2 text-sm rounded-md cursor-pointer data-[selected=true]:bg-zinc-100 dark:data-[selected=true]:bg-zinc-800"
                  >
                    <Calendar className="h-4 w-4 text-zinc-500 shrink-0" />
                    <span className="flex-1 truncate">{c.name}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
            {results.users.length > 0 && (
              <Command.Group
                heading="People"
                className="text-[10px] uppercase tracking-wider text-zinc-400 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1"
              >
                {results.users.map((u) => (
                  <Command.Item
                    key={u.id}
                    value={`user-${u.id}-${u.name}`}
                    onSelect={() => go(`/settings/members`)}
                    className="flex items-center gap-3 px-3 py-2 text-sm rounded-md cursor-pointer data-[selected=true]:bg-zinc-100 dark:data-[selected=true]:bg-zinc-800"
                  >
                    <User className="h-4 w-4 text-zinc-500 shrink-0" />
                    <span className="flex-1 truncate">{u.name}</span>
                    <span className="text-xs text-zinc-400 shrink-0 truncate max-w-[12rem]">
                      {u.email}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
          <div className="px-3 py-1.5 border-t border-zinc-200 dark:border-zinc-800 text-[10px] text-zinc-400 flex items-center justify-between">
            <span>Tip: press ⌘K from anywhere</span>
            <span>↑↓ to navigate · ↵ to select</span>
          </div>
        </Command>
      </div>
    </div>
  );
}
