import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CreateOrganization } from "@clerk/nextjs";

import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { getAuthContext } from "@/lib/auth/get-current-user";
import { scopedDb } from "@/lib/db/scoped";

function daysUntil(target: Date): number {
  const from = new Date();
  if (target.getTime() <= from.getTime()) return 0;
  return Math.ceil(
    (target.getTime() - from.getTime()) / (1000 * 60 * 60 * 24),
  );
}

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  if (!session.userId) redirect("/sign-in");

  if (!session.orgId) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-md w-full space-y-4 text-center">
          <h1 className="text-xl font-semibold">
            Create your organization to continue
          </h1>
          <p className="text-sm text-zinc-500">
            OKR App is organized around teams. Create one to get started.
          </p>
          <CreateOrganization afterCreateOrganizationUrl="/dashboard" />
        </div>
      </div>
    );
  }

  // Hydrates Postgres rows if the Clerk webhook hasn't landed yet.
  const ctx = await getAuthContext();
  const org = await scopedDb(ctx.orgId).getOrganization();
  const trialEndsAt = org?.trialEndsAt ? new Date(org.trialEndsAt) : null;
  const trialDaysLeft = trialEndsAt ? daysUntil(trialEndsAt) : 0;
  const showTrialBanner =
    org?.plan === "free" && trialDaysLeft > 0 && trialDaysLeft <= 14;

  return (
    <div className="flex flex-1 min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        {showTrialBanner && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900 px-4 py-2 text-xs flex items-center justify-between">
            <span className="text-amber-900 dark:text-amber-300">
              Starter trial: {trialDaysLeft} day
              {trialDaysLeft === 1 ? "" : "s"} left.
            </span>
            <Link
              href="/settings/billing"
              className="text-amber-900 dark:text-amber-300 underline hover:no-underline"
            >
              Upgrade →
            </Link>
          </div>
        )}
        <main className="flex-1 p-6 bg-zinc-50 dark:bg-zinc-900">
          {children}
        </main>
      </div>
    </div>
  );
}
