import { TeamsPage } from "@/components/settings/teams-page";
import { getAuthContext } from "@/lib/auth/get-current-user";

export default async function Page() {
  const ctx = await getAuthContext();
  return <TeamsPage currentRole={ctx.role} />;
}
