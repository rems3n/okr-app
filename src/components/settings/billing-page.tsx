"use client";

import { useState } from "react";

import { apiSend, ApiRequestError } from "@/lib/api/client";
import { can, type Role } from "@/lib/auth/permissions";
import type { Plan, PlanLimits } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

const PRICE_OPTIONS = [
  { key: "starter_monthly" as const, plan: "starter", label: "Starter · $29/mo" },
  { key: "starter_annual" as const, plan: "starter", label: "Starter · $290/yr (save 2 months)" },
  { key: "growth_monthly" as const, plan: "growth", label: "Growth · $79/mo" },
  { key: "growth_annual" as const, plan: "growth", label: "Growth · $790/yr (save 2 months)" },
];

export function BillingClient({
  currentRole,
  plan,
  effectivePlan,
  trialDaysLeft,
  hasSubscription,
  limits,
}: {
  currentRole: Role;
  plan: Plan;
  effectivePlan: Plan;
  trialDaysLeft: number;
  hasSubscription: boolean;
  limits: PlanLimits;
}) {
  const canBill = can(currentRole, "org.billing");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkout = async (priceKey: typeof PRICE_OPTIONS[number]["key"]) => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiSend<{ url: string }>(
        "/api/v1/billing/checkout",
        "POST",
        { priceKey },
      );
      window.location.assign(res.url);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed");
      setBusy(false);
    }
  };

  const portal = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiSend<{ url: string }>(
        "/api/v1/billing/portal",
        "POST",
        {},
      );
      window.location.assign(res.url);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed");
      setBusy(false);
    }
  };

  return (
    <section className="space-y-6 max-w-2xl">
      <header>
        <h2 className="text-lg font-semibold">Billing</h2>
        <p className="text-sm text-zinc-500">
          Manage your subscription, usage, and seats.
        </p>
      </header>

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm">
            Current plan:{" "}
            <span className="font-medium capitalize">{plan}</span>
            {effectivePlan !== plan && (
              <span className="text-xs text-zinc-500 ml-2">
                (trialing {effectivePlan})
              </span>
            )}
          </p>
          {trialDaysLeft > 0 && (
            <span className="text-xs rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5">
              Trial — {trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} left
            </span>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-2 text-xs text-zinc-600 dark:text-zinc-400 mt-2">
          <Limit label="Members" value={limits.users} />
          <Limit label="Objectives" value={limits.objectives} />
          <Limit label="Integrations" value={limits.integrations} />
          <Limit label="AI drafts / mo" value={limits.ai_drafts} />
        </dl>
      </div>

      {canBill ? (
        <>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-3">
            <p className="text-sm font-medium">Upgrade</p>
            <div className="grid grid-cols-1 gap-2">
              {PRICE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => checkout(opt.key)}
                  disabled={busy}
                  className={cn(
                    "text-left rounded-md border px-3 py-2 text-sm flex items-center justify-between",
                    "border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-50",
                  )}
                >
                  <span>{opt.label}</span>
                  <span className="text-xs text-zinc-500">Checkout →</span>
                </button>
              ))}
            </div>
          </div>

          {hasSubscription && (
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Manage subscription</p>
                <p className="text-xs text-zinc-500">
                  Open the Stripe-hosted portal for invoices, payment method,
                  and cancellation.
                </p>
              </div>
              <button
                type="button"
                onClick={portal}
                disabled={busy}
                className="text-sm rounded-md bg-zinc-900 text-white px-3 py-1.5 dark:bg-zinc-50 dark:text-zinc-900 disabled:opacity-50"
              >
                Customer portal
              </button>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
        </>
      ) : (
        <p className="text-sm text-zinc-500">
          Only the organization owner can manage billing.
        </p>
      )}
    </section>
  );
}

function Limit({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-medium text-zinc-800 dark:text-zinc-200">
        {value === -1 ? "Unlimited" : value}
      </dd>
    </div>
  );
}
