"use client";

import { useState } from "react";

import { useMembers } from "@/hooks/use-members";
import { useTeams, useTeamMembers } from "@/hooks/use-teams";
import { apiSend, ApiRequestError } from "@/lib/api/client";
import { can, type Role } from "@/lib/auth/permissions";

export function TeamsPage({ currentRole }: { currentRole: Role }) {
  const { teams, isLoading, mutate } = useTeams();
  const [creating, setCreating] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  const canCreate = can(currentRole, "team.create");
  const canDelete = can(currentRole, "team.delete");
  const canManage = can(currentRole, "team.manage");

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Teams</h2>
          <p className="text-sm text-zinc-500">
            {teams.length} {teams.length === 1 ? "team" : "teams"}
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            className="rounded-md bg-zinc-900 text-white px-3 py-1.5 text-sm hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            onClick={() => setCreating(true)}
          >
            Create team
          </button>
        )}
      </header>

      {creating && (
        <CreateTeamDialog
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            mutate();
          }}
        />
      )}

      <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 divide-y divide-zinc-200 dark:divide-zinc-800">
        {isLoading ? (
          <p className="px-4 py-6 text-sm text-zinc-500">Loading…</p>
        ) : teams.length === 0 ? (
          <p className="px-4 py-6 text-sm text-zinc-500">No teams yet.</p>
        ) : (
          teams.map((t) => (
            <button
              type="button"
              key={t.id}
              className="w-full text-left px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 flex items-center justify-between"
              onClick={() => setSelectedTeamId(t.id)}
            >
              <span className="font-medium">{t.name}</span>
              <span className="text-xs text-zinc-500">Manage →</span>
            </button>
          ))
        )}
      </div>

      {selectedTeamId && (
        <TeamDetailDrawer
          teamId={selectedTeamId}
          canManage={canManage}
          canDelete={canDelete}
          onClose={() => setSelectedTeamId(null)}
          onDeleted={() => {
            setSelectedTeamId(null);
            mutate();
          }}
        />
      )}
    </section>
  );
}

function CreateTeamDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiSend("/api/v1/teams", "POST", { name });
      onCreated();
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
        className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-lg p-6 space-y-4 border border-zinc-200 dark:border-zinc-800"
      >
        <h3 className="text-lg font-semibold">Create team</h3>
        <label className="block text-sm space-y-1">
          <span className="text-zinc-700 dark:text-zinc-300">Name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
            placeholder="Engineering"
          />
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

function TeamDetailDrawer({
  teamId,
  canManage,
  canDelete,
  onClose,
  onDeleted,
}: {
  teamId: string;
  canManage: boolean;
  canDelete: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { members: teamMembers, mutate: mutateMembers } = useTeamMembers(teamId);
  const { members: orgMembers } = useMembers();
  const [addUserId, setAddUserId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableToAdd = orgMembers.filter(
    (m) => !teamMembers.some((tm) => tm.userId === m.id),
  );

  const add = async () => {
    if (!addUserId) return;
    setBusy(true);
    setError(null);
    try {
      await apiSend(`/api/v1/teams/${teamId}/members`, "POST", {
        userId: addUserId,
      });
      setAddUserId("");
      mutateMembers();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const toggleLead = async (userId: string, isLead: boolean) => {
    try {
      await apiSend(`/api/v1/teams/${teamId}/members`, "POST", {
        userId,
        isLead,
      });
      mutateMembers();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed");
    }
  };

  const remove = async (userId: string) => {
    try {
      await apiSend(`/api/v1/teams/${teamId}/members`, "DELETE", { userId });
      mutateMembers();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed");
    }
  };

  const deleteTeam = async () => {
    if (!confirm("Delete this team? This cannot be undone.")) return;
    try {
      await apiSend(`/api/v1/teams/${teamId}`, "DELETE");
      onDeleted();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed");
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/30 z-50 flex justify-end"
      onClick={onClose}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white dark:bg-zinc-900 h-full p-6 overflow-y-auto space-y-4 border-l border-zinc-200 dark:border-zinc-800"
      >
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Team members</h3>
          <button
            type="button"
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {canManage && availableToAdd.length > 0 && (
          <div className="flex gap-2 items-end">
            <label className="flex-1 text-sm space-y-1">
              <span className="text-zinc-700 dark:text-zinc-300">Add member</span>
              <select
                value={addUserId}
                onChange={(e) => setAddUserId(e.target.value)}
                className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
              >
                <option value="">Pick someone…</option>
                {availableToAdd.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={add}
              disabled={!addUserId || busy}
              className="px-3 py-2 text-sm rounded-md bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        )}

        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-lg">
          {teamMembers.length === 0 ? (
            <li className="px-3 py-4 text-sm text-zinc-500">No members yet.</li>
          ) : (
            teamMembers.map((m) => (
              <li
                key={m.id}
                className="px-3 py-2 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-sm">{m.userName}</p>
                  <p className="text-xs text-zinc-500">{m.userEmail}</p>
                </div>
                <div className="flex items-center gap-2">
                  {canManage && (
                    <label className="text-xs flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={m.isLead}
                        onChange={(e) => toggleLead(m.userId, e.target.checked)}
                      />
                      Lead
                    </label>
                  )}
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => remove(m.userId)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </li>
            ))
          )}
        </ul>

        {error && <p className="text-sm text-red-500">{error}</p>}

        {canDelete && (
          <button
            type="button"
            onClick={deleteTeam}
            className="w-full text-sm rounded-md border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 py-2 hover:bg-red-50 dark:hover:bg-red-950"
          >
            Delete team
          </button>
        )}
      </aside>
    </div>
  );
}
