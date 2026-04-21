"use client";

import { useState } from "react";

import { apiSend, ApiRequestError } from "@/lib/api/client";

export function ShareControls({ cycleId }: { cycleId: string }) {
  const [busy, setBusy] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiSend<{ url: string; expiresAt: string }>(
        `/api/v1/cycles/${cycleId}/share`,
        "POST",
        {},
      );
      setShareUrl(res.url);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2 text-xs">
      {shareUrl ? (
        <>
          <code className="rounded-md bg-zinc-100 dark:bg-zinc-900 px-2 py-1 max-w-xs truncate">
            {shareUrl}
          </code>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(shareUrl)}
            className="rounded-md border border-zinc-200 dark:border-zinc-700 px-2 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-900"
          >
            Copy
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className="rounded-md bg-zinc-900 text-white px-2.5 py-1 dark:bg-zinc-50 dark:text-zinc-900 disabled:opacity-50"
        >
          {busy ? "Generating…" : "Create share link"}
        </button>
      )}
      {error && <span className="text-red-500">{error}</span>}
    </div>
  );
}
