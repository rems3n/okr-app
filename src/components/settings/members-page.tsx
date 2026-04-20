"use client";

import { useEffect, useState } from "react";

import { useMembers } from "@/hooks/use-members";
import { apiGet, apiSend, ApiRequestError } from "@/lib/api/client";
import { can, type Role } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

type ManagerMap = Record<string, string | null>;

async function fetchManagers(userIds: string[]): Promise<ManagerMap> {
  const entries = await Promise.all(
    userIds.map(async (id) => {
      try {
        const res = await apiGet<{ managerUserId: string | null } | null>(
          `/api/v1/users/${id}/manager`,
        );
        return [id, res?.managerUserId ?? null] as const;
      } catch {
        return [id, null] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}

export function MembersPage({
  currentUserId,
  currentRole,
}: {
  currentUserId: string;
  currentRole: Role;
}) {
  const { members, isLoading, mutate } = useMembers();
  const [managers, setManagers] = useState<ManagerMap>({});
  const [inviteOpen, setInviteOpen] = useState(false);

  const canInvite = can(currentRole, "member.invite");
  const canAssignManager = can(currentRole, "manager.assign");

  useEffect(() => {
    if (members.length === 0) return;
    fetchManagers(members.map((m) => m.id)).then(setManagers);
  }, [members]);

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Members</h2>
          <p className="text-sm text-zinc-500">
            {members.length} {members.length === 1 ? "member" : "members"}
          </p>
        </div>
        {canInvite && (
          <button
            type="button"
            className="rounded-md bg-zinc-900 text-white px-3 py-1.5 text-sm hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            onClick={() => setInviteOpen(true)}
          >
            Invite member
          </button>
        )}
      </header>

      {inviteOpen && (
        <InviteDialog
          onClose={() => setInviteOpen(false)}
          onInvited={() => {
            setInviteOpen(false);
            mutate();
          }}
        />
      )}

      <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-950">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900 text-zinc-500">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Name</th>
              <th className="text-left px-4 py-2 font-medium">Email</th>
              <th className="text-left px-4 py-2 font-medium">Role</th>
              <th className="text-left px-4 py-2 font-medium">Manager</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-zinc-500">
                  Loading…
                </td>
              </tr>
            ) : members.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-zinc-500">
                  No members yet.
                </td>
              </tr>
            ) : (
              members.map((m) => (
                <tr
                  key={m.id}
                  className="border-t border-zinc-200 dark:border-zinc-800"
                >
                  <td className="px-4 py-2">
                    <span className="font-medium">{m.name}</span>
                    {m.id === currentUserId && (
                      <span className="ml-2 text-xs text-zinc-500">(you)</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                    {m.email}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={cn(
                        "text-xs rounded-full px-2 py-0.5",
                        m.role === "owner"
                          ? "bg-purple-100 text-purple-800"
                          : m.role === "admin"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-zinc-100 text-zinc-700",
                      )}
                    >
                      {m.role}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <ManagerPicker
                      userId={m.id}
                      currentManagerId={managers[m.id] ?? null}
                      candidates={members.filter((c) => c.id !== m.id)}
                      disabled={!canAssignManager}
                      onChange={async () => {
                        const next = await fetchManagers([m.id]);
                        setManagers((prev) => ({ ...prev, ...next }));
                      }}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ManagerPicker({
  userId,
  currentManagerId,
  candidates,
  disabled,
  onChange,
}: {
  userId: string;
  currentManagerId: string | null;
  candidates: { id: string; name: string }[];
  disabled: boolean;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSelect = async (value: string) => {
    setBusy(true);
    setError(null);
    try {
      if (value === "") {
        await apiSend(`/api/v1/users/${userId}/manager`, "DELETE");
      } else {
        await apiSend(`/api/v1/users/${userId}/manager`, "POST", {
          managerUserId: value,
        });
      }
      onChange();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <select
        className="bg-transparent border border-zinc-200 dark:border-zinc-700 rounded-md px-2 py-1 text-sm disabled:opacity-50"
        value={currentManagerId ?? ""}
        onChange={(e) => onSelect(e.target.value)}
        disabled={disabled || busy}
      >
        <option value="">No manager</option>
        {candidates.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}

function InviteDialog({
  onClose,
  onInvited,
}: {
  onClose: () => void;
  onInvited: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiSend("/api/v1/members/invite", "POST", { email, role });
      onInvited();
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
        <h3 className="text-lg font-semibold">Invite a member</h3>
        <label className="block text-sm space-y-1">
          <span className="text-zinc-700 dark:text-zinc-300">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
            placeholder="teammate@company.com"
          />
        </label>
        <label className="block text-sm space-y-1">
          <span className="text-zinc-700 dark:text-zinc-300">Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "admin" | "member")}
            className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
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
            {busy ? "Sending…" : "Send invite"}
          </button>
        </div>
      </form>
    </div>
  );
}
