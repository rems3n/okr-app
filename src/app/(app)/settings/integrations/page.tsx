import { IntegrationsPage } from "@/components/settings/integrations-page";
import { getAuthContext } from "@/lib/auth/get-current-user";

export default async function Page() {
  const ctx = await getAuthContext();
  return <IntegrationsPage currentRole={ctx.role} />;
}
