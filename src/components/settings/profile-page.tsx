"use client";

import { useState } from "react";

import { useCurrentUser, type CurrentUserResponse } from "@/hooks/use-current-user";
import { useMembers } from "@/hooks/use-members";
import { apiSend, ApiRequestError } from "@/lib/api/client";

const TIMEZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

export function ProfilePage() {
  const { me, mutate } = useCurrentUser();
  if (!me) {
    return <p className="text-sm text-zinc-500">Loading…</p>;
  }
  return <ProfileForm key={me.user.id} me={me} mutate={mutate} />;
}

type MutateFn = () => Promise<unknown>;

function ProfileForm({ me, mutate }: { me: CurrentUserResponse; mutate: MutateFn }) {
  const { members } = useMembers();
  const [name, setName] = useState(me.user.name);
  const [timezone, setTimezone] = useState(me.user.timezone);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const manager = members.find((m) => m.id === me.managerUserId) ?? null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setStatus("idle");
    setError(null);
    try {
      await apiSend("/api/v1/users/me", "PATCH", { name, timezone });
      await mutate();
      setStatus("saved");
    } catch (err) {
      setStatus("error");
      setError(err instanceof ApiRequestError ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-6 max-w-lg">
      <div>
        <h2 className="text-lg font-semibold">Profile</h2>
        <p className="text-sm text-zinc-500">
          Email and avatar are managed in your Clerk account.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm space-y-1">
          <span className="text-zinc-700 dark:text-zinc-300">Name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
          />
        </label>

        <label className="block text-sm space-y-1">
          <span className="text-zinc-700 dark:text-zinc-300">Email</span>
          <input
            readOnly
            value={me.user.email}
            className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-500"
          />
        </label>

        <label className="block text-sm space-y-1">
          <span className="text-zinc-700 dark:text-zinc-300">Timezone</span>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="px-3 py-1.5 text-sm rounded-md bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
          {status === "saved" && (
            <span className="text-sm text-emerald-600">Saved</span>
          )}
          {status === "error" && (
            <span className="text-sm text-red-500">{error}</span>
          )}
        </div>
      </form>

      <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 space-y-2">
        <p className="text-sm text-zinc-500">Manager</p>
        <p className="text-sm">
          {manager ? manager.name : "No manager assigned yet."}
        </p>
        <p className="text-xs text-zinc-500">
          Your manager is assigned by an admin on the Members tab.
        </p>
      </div>
    </section>
  );
}
