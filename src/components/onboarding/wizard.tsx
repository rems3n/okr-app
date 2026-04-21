"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { DraftAssistant } from "@/components/ai/draft-assistant";
import { apiSend, ApiRequestError } from "@/lib/api/client";

const SIZES = ["1-10", "11-25", "26-50", "50+"] as const;
const INDUSTRIES = [
  "Technology",
  "Healthcare",
  "Finance",
  "E-commerce",
  "Other",
];

type Step = 1 | 2 | 3;

/**
 * Three-step first-run wizard for new orgs:
 *   1. Company profile (size + industry — informs AI prompts later)
 *   2. Create first cycle
 *   3. Optional: draft objectives with AI
 * Sets organizations.onboarding_completed = true at the end and routes the
 * user into /dashboard.
 */
export function OnboardingWizard({ currentUserId }: { currentUserId: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [size, setSize] = useState<(typeof SIZES)[number]>("11-25");
  const [industry, setIndustry] = useState<string>("Technology");
  const [cycleId, setCycleId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiSend("/api/v1/organization", "PATCH", {
        onboardingCompleted: true,
      });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed");
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-8 space-y-6 shadow-sm">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-violet-600">
          Setup · {step} of 3
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {step === 1 && "Tell us about your company"}
          {step === 2 && "Create your first cycle"}
          {step === 3 && "Draft your first objectives"}
        </h1>
        <p className="text-sm text-zinc-500">
          {step === 1 && "Two quick questions so AI suggestions are relevant."}
          {step === 2 &&
            "Cycles are usually quarterly — we've pre-filled this quarter."}
          {step === 3 &&
            "Skip if you'd rather start from scratch — you can draft later from the Objectives page."}
        </p>
      </header>

      {error && (
        <p className="text-sm text-red-500 border border-red-200 dark:border-red-900 rounded-md px-3 py-2 bg-red-50 dark:bg-red-950/40">
          {error}
        </p>
      )}

      {step === 1 && (
        <ProfileStep
          size={size}
          industry={industry}
          onSize={setSize}
          onIndustry={setIndustry}
          busy={busy}
          onNext={async () => {
            setBusy(true);
            setError(null);
            try {
              await apiSend("/api/v1/organization", "PATCH", {
                companySize: size,
                industry,
              });
              setStep(2);
            } catch (err) {
              setError(err instanceof ApiRequestError ? err.message : "Failed");
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      {step === 2 && (
        <CycleStep
          busy={busy}
          onCreate={async (input) => {
            setBusy(true);
            setError(null);
            try {
              const created = await apiSend<{ id: string }>(
                "/api/v1/cycles",
                "POST",
                input,
              );
              await apiSend(`/api/v1/cycles/${created.id}`, "PATCH", {
                status: "active",
              });
              setCycleId(created.id);
              setStep(3);
            } catch (err) {
              setError(err instanceof ApiRequestError ? err.message : "Failed");
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      {step === 3 && cycleId && (
        <DraftStep
          cycleId={cycleId}
          currentUserId={currentUserId}
          busy={busy}
          onFinish={finish}
        />
      )}
    </div>
  );
}

function ProfileStep({
  size,
  industry,
  onSize,
  onIndustry,
  busy,
  onNext,
}: {
  size: (typeof SIZES)[number];
  industry: string;
  onSize: (v: (typeof SIZES)[number]) => void;
  onIndustry: (v: string) => void;
  busy: boolean;
  onNext: () => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium mb-2">Company size</p>
        <div className="grid grid-cols-4 gap-2">
          {SIZES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSize(s)}
              className={`rounded-md border px-3 py-2 text-sm ${
                size === s
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                  : "border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium mb-2">Industry</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {INDUSTRIES.map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => onIndustry(i)}
              className={`rounded-md border px-3 py-2 text-sm ${
                industry === i
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                  : "border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              }`}
            >
              {i}
            </button>
          ))}
        </div>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onNext}
          disabled={busy}
          className="rounded-md bg-zinc-900 text-white px-4 py-1.5 text-sm dark:bg-zinc-50 dark:text-zinc-900 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Continue"}
        </button>
      </div>
    </div>
  );
}

function defaultQuarter() {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3) + 1;
  const startMonth = (q - 1) * 3;
  const start = new Date(now.getFullYear(), startMonth, 1);
  const end = new Date(now.getFullYear(), startMonth + 3, 0);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return {
    name: `Q${q} ${now.getFullYear()}`,
    startDate: fmt(start),
    endDate: fmt(end),
  };
}

function CycleStep({
  busy,
  onCreate,
}: {
  busy: boolean;
  onCreate: (input: {
    name: string;
    startDate: string;
    endDate: string;
  }) => void;
}) {
  const [pre] = useState(() => defaultQuarter());
  const [name, setName] = useState(pre.name);
  const [startDate, setStart] = useState(pre.startDate);
  const [endDate, setEnd] = useState(pre.endDate);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onCreate({ name, startDate, endDate });
      }}
      className="space-y-4"
    >
      <label className="block text-sm space-y-1">
        <span className="text-zinc-700 dark:text-zinc-300">Cycle name</span>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm space-y-1">
          <span className="text-zinc-700 dark:text-zinc-300">Start</span>
          <input
            type="date"
            required
            value={startDate}
            onChange={(e) => setStart(e.target.value)}
            className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm space-y-1">
          <span className="text-zinc-700 dark:text-zinc-300">End</span>
          <input
            type="date"
            required
            value={endDate}
            onChange={(e) => setEnd(e.target.value)}
            className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
          />
        </label>
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-zinc-900 text-white px-4 py-1.5 text-sm dark:bg-zinc-50 dark:text-zinc-900 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create + activate"}
        </button>
      </div>
    </form>
  );
}

function DraftStep({
  cycleId,
  currentUserId,
  busy,
  onFinish,
}: {
  cycleId: string;
  currentUserId: string;
  busy: boolean;
  onFinish: () => void;
}) {
  const [draftOpen, setDraftOpen] = useState(false);
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-violet-200 dark:border-violet-900 bg-violet-50 dark:bg-violet-950/40 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-600" />
          <p className="text-sm font-medium text-violet-900 dark:text-violet-200">
            Have AI draft 3-5 candidate objectives
          </p>
        </div>
        <p className="text-xs text-violet-800/80 dark:text-violet-300/80">
          Pick the ones you like — they create as full objectives with KRs in
          one click. You can edit anything afterwards.
        </p>
        <button
          type="button"
          onClick={() => setDraftOpen(true)}
          className="rounded-md bg-violet-700 text-white px-3 py-1.5 text-sm hover:bg-violet-800"
        >
          Open draft assistant
        </button>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">
          You can also start from scratch from the Objectives page later.
        </p>
        <button
          type="button"
          onClick={onFinish}
          disabled={busy}
          className="rounded-md bg-zinc-900 text-white px-4 py-1.5 text-sm dark:bg-zinc-50 dark:text-zinc-900 disabled:opacity-50"
        >
          {busy ? "Finishing…" : "Finish setup"}
        </button>
      </div>

      {draftOpen && (
        <DraftAssistant
          cycleId={cycleId}
          currentUserId={currentUserId}
          onClose={() => setDraftOpen(false)}
          onCreated={() => {
            // Stay open so the user can pick more if they want.
          }}
        />
      )}
    </div>
  );
}
