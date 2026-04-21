import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { OnboardingWizard } from "@/components/onboarding/wizard";
import { getAuthContext } from "@/lib/auth/get-current-user";
import { scopedDb } from "@/lib/db/scoped";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session.userId) redirect("/sign-in");
  if (!session.orgId) redirect("/dashboard"); // (app) layout handles org creation

  const ctx = await getAuthContext();
  const org = await scopedDb(ctx.orgId).getOrganization();
  if (org?.onboardingCompleted) {
    redirect("/dashboard");
  }
  return <OnboardingWizard currentUserId={ctx.userId} />;
}
