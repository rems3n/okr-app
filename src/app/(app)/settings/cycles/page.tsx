import { CyclesPage } from "@/components/settings/cycles-page";
import { getAuthContext } from "@/lib/auth/get-current-user";

export default async function Page() {
  const ctx = await getAuthContext();
  return <CyclesPage currentRole={ctx.role} />;
}
