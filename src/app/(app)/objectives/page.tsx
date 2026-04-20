import { ObjectivesPage } from "@/components/okr/objectives-page";
import { getAuthContext } from "@/lib/auth/get-current-user";

export default async function Page() {
  const ctx = await getAuthContext();
  return <ObjectivesPage currentUserId={ctx.userId} />;
}
