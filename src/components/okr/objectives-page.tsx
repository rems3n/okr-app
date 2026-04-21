"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { DraftAssistant } from "@/components/ai/draft-assistant";
import { ExpandableObjectiveRow } from "@/components/okr/expandable-objective-row";
import { OkrTree } from "@/components/okr/okr-tree";
import { useCycles } from "@/hooks/use-cycles";
import { useMembers } from "@/hooks/use-members";
import { useObjectives } from "@/hooks/use-objectives";
import { useTeams } from "@/hooks/use-teams";
import { apiSend, ApiRequestError } from "@/lib/api/client";
import { can, type Role } from "@/lib/auth/permissions";
import type { Objective } from "@/lib/db/schema";

type View = "tree" | "list";

export function ObjectivesPage({
  currentUserId,
  currentRole,
}: {
  currentUserId: string;
  currentRole: Role;
}) {
  const { cycles, isLoading: cyclesLoading } = useCycles();
  const defaultCycleId = useMemo(() => {
    if (cycles.length === 0) return null;
    const active = cycles.find((c) => c.status === "active");
    return active?.id ?? cycles[0].id;
  }, [cycles]);
  const [cycleId, setCycleId] = useState<string | null>(null);
  const effectiveCycleId = cycleId ?? defaultCycleId;
  const { objectives, isLoading, mutate } = useObjectives(effectiveCycleId);
  const { teams } = useTeams();
  const { members } = useMembers();

  const [view, setView] = useState<View>("tree");
  const [teamFilter, setTeamFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const wantCreate = searchParams.get("create") === "1";
  const wantDraft = searchParams.get("draft") === "1";
  const [creating, setCreating] = useState(() => wantCreate);
  const [draftOpen, setDraftOpen] = useState(() => wantDraft);

  // Strip the params after we've consumed them so reloads don't reopen.
  useEffect(() => {
    if (!wantCreate && !wantDraft) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("create");
    url.searchParams.delete("draft");
    router.replace(`${url.pathname}${url.search}`);
  }, [wantCreate, wantDraft, router]);

  const cycle = cycles.find((c) => c.id === effectiveCycleId) ?? null;

  const filtered = useMemo(() => {
    return objectives.filter((o) => {
      if (teamFilter && o.teamId !== teamFilter) return false;
      if (ownerFilter && o.ownerUserId !== ownerFilter) return false;
      if (statusFilter && o.status !== statusFilter) return false;
      if (
        search &&
        !o.title.toLowerCase().includes(search.toLowerCase())
      )
        return false;
      return true;
    });
  }, [objectives, teamFilter, ownerFilter, statusFilter, search]);

  // Keep ancestor rows visible in tree mode so filtered rows still anchor
  // to their parent chain. Without this, a filter that hides a parent
  // would orphan its children.
  const visibleForTree = useMemo(() => {
    if (view !== "tree" || filtered.length === objectives.length) {
      return filtered;
    }
    const keep = new Set(filtered.map((o) => o.id));
    for (const o of filtered) {
      let cur: Objective | undefined = o;
      while (cur?.parentObjectiveId) {
        const parent = objectives.find((p) => p.id === cur!.parentObjectiveId);
        if (!parent) break;
        keep.add(parent.id);
        cur = parent;
      }
    }
    return objectives.filter((o) => keep.has(o.id));
  }, [view, filtered, objectives]);

  if (cyclesLoading) {
    return <p className="text-sm text-zinc-500">Loading…</p>;
  }
  if (cycles.length === 0) {
    return (
      <div className="max-w-md space-y-3">
        <h1 className="text-xl font-semibold">No cycles yet</h1>
        <p className="text-sm text-zinc-500">
          Create your first cycle before writing objectives.
        </p>
        <Link
          href="/settings/cycles"
          className="inline-flex rounded-md bg-zinc-900 text-white px-3 py-1.5 text-sm dark:bg-zinc-50 dark:text-zinc-900"
        >
          Go to cycles →
        </Link>
      </div>
    );
  }

  return (
    <section className="space-y-4 max-w-6xl">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Objectives</h1>
          <p className="text-sm text-zinc-500">
            {filtered.length} of {objectives.length} in this cycle
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={effectiveCycleId ?? ""}
            onChange={(e) => setCycleId(e.target.value || null)}
            className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-2 py-1.5 text-sm"
          >
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.status === "active" ? " · active" : ""}
              </option>
            ))}
          </select>
          <div className="rounded-md border border-zinc-200 dark:border-zinc-700 text-xs overflow-hidden">
            <button
              type="button"
              onClick={() => setView("tree")}
              className={`px-2 py-1.5 ${view === "tree" ? "bg-zinc-100 dark:bg-zinc-800" : ""}`}
            >
              Tree
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={`px-2 py-1.5 ${view === "list" ? "bg-zinc-100 dark:bg-zinc-800" : ""}`}
            >
              List
            </button>
          </div>
          {effectiveCycleId && (
            <>
              <button
                type="button"
                onClick={() => setDraftOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-violet-200 dark:border-violet-900 text-violet-700 dark:text-violet-300 px-3 py-1.5 text-sm hover:bg-violet-50 dark:hover:bg-violet-950"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Draft with AI
              </button>
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="rounded-md bg-zinc-900 text-white px-3 py-1.5 text-sm dark:bg-zinc-50 dark:text-zinc-900"
              >
                New objective
              </button>
            </>
          )}
        </div>
      </header>

      <FilterBar
        search={search}
        setSearch={setSearch}
        teamFilter={teamFilter}
        setTeamFilter={setTeamFilter}
        ownerFilter={ownerFilter}
        setOwnerFilter={setOwnerFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        teams={teams}
        members={members}
      />

      {creating && effectiveCycleId && (
        <CreateObjectiveDialog
          cycleId={effectiveCycleId}
          currentUserId={currentUserId}
          existingObjectives={objectives}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            mutate();
            // Land on the new objective so the user can add KRs in place.
            router.push(`/objectives/${id}?addKr=1`);
          }}
        />
      )}

      {isLoading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : view === "tree" ? (
        <OkrTree
          objectives={visibleForTree}
          cycle={cycle}
          currentUserId={currentUserId}
          currentRole={currentRole}
        />
      ) : (
        <ListView
          objectives={filtered}
          cycle={cycle}
          currentUserId={currentUserId}
          currentRole={currentRole}
        />
      )}

      {draftOpen && effectiveCycleId && (
        <DraftAssistant
          cycleId={effectiveCycleId}
          currentUserId={currentUserId}
          onClose={() => setDraftOpen(false)}
          onCreated={() => {
            mutate();
          }}
        />
      )}
    </section>
  );
}

function ListView({
  objectives,
  cycle,
  currentUserId,
  currentRole,
}: {
  objectives: Objective[];
  cycle: { startDate: string; endDate: string } | null;
  currentUserId: string;
  currentRole: Role;
}) {
  if (objectives.length === 0) {
    return (
      <p className="text-sm text-zinc-500 px-4 py-6 border border-zinc-200 dark:border-zinc-800 rounded-lg">
        Nothing matches the current filters.
      </p>
    );
  }
  const isAdmin = can(currentRole, "team.manage");
  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950">
      {objectives.map((o) => {
        const isOwner = o.ownerUserId === currentUserId;
        return (
          <ExpandableObjectiveRow
            key={o.id}
            objective={o}
            cycle={cycle}
            canEditObjective={isOwner || isAdmin}
            canEditKrs={isOwner || isAdmin}
          />
        );
      })}
    </div>
  );
}

function FilterBar({
  search,
  setSearch,
  teamFilter,
  setTeamFilter,
  ownerFilter,
  setOwnerFilter,
  statusFilter,
  setStatusFilter,
  teams,
  members,
}: {
  search: string;
  setSearch: (s: string) => void;
  teamFilter: string;
  setTeamFilter: (s: string) => void;
  ownerFilter: string;
  setOwnerFilter: (s: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  teams: { id: string; name: string }[];
  members: { id: string; name: string }[];
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap text-sm">
      <input
        placeholder="Search title…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-2 py-1.5 text-sm min-w-40"
      />
      <select
        value={teamFilter}
        onChange={(e) => setTeamFilter(e.target.value)}
        className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-2 py-1.5"
      >
        <option value="">All teams</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <select
        value={ownerFilter}
        onChange={(e) => setOwnerFilter(e.target.value)}
        className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-2 py-1.5"
      >
        <option value="">All owners</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-2 py-1.5"
      >
        <option value="">All statuses</option>
        <option value="draft">Draft</option>
        <option value="active">Active</option>
        <option value="closed">Closed</option>
      </select>
    </div>
  );
}

type ObjectiveListItem = { id: string; title: string };

function CreateObjectiveDialog({
  cycleId,
  currentUserId,
  existingObjectives,
  onClose,
  onCreated,
}: {
  cycleId: string;
  currentUserId: string;
  existingObjectives: ObjectiveListItem[];
  onClose: () => void;
  onCreated: (createdId: string) => void;
}) {
  const { members } = useMembers();
  const { teams } = useTeams();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ownerUserId, setOwnerUserId] = useState(currentUserId);
  const [teamId, setTeamId] = useState<string>("");
  const [parentObjectiveId, setParentObjectiveId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await apiSend<{ id: string }>(
        "/api/v1/objectives",
        "POST",
        {
          cycleId,
          title,
          description: description || null,
          ownerUserId,
          teamId: teamId || null,
          parentObjectiveId: parentObjectiveId || null,
        },
      );
      onCreated(created.id);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-lg p-6 space-y-4 border border-zinc-200 dark:border-zinc-800"
      >
        <h3 className="text-lg font-semibold">New objective</h3>
        <label className="block text-sm space-y-1">
          <span className="text-zinc-700 dark:text-zinc-300">Title</span>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm space-y-1">
          <span className="text-zinc-700 dark:text-zinc-300">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm space-y-1">
            <span className="text-zinc-700 dark:text-zinc-300">Owner</span>
            <select
              value={ownerUserId}
              onChange={(e) => setOwnerUserId(e.target.value)}
              className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm space-y-1">
            <span className="text-zinc-700 dark:text-zinc-300">Team</span>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
            >
              <option value="">No team (individual or company)</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-sm space-y-1">
          <span className="text-zinc-700 dark:text-zinc-300">Aligns to</span>
          <select
            value={parentObjectiveId}
            onChange={(e) => setParentObjectiveId(e.target.value)}
            className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
          >
            <option value="">— top level —</option>
            {existingObjectives.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </select>
        </label>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="px-3 py-1.5 text-sm rounded-md border border-zinc-200 dark:border-zinc-700"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-3 py-1.5 text-sm rounded-md bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 disabled:opacity-50"
            disabled={busy}
          >
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}
