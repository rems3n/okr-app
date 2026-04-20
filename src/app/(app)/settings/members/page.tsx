import { MembersPage } from "@/components/settings/members-page";
import { getAuthContext } from "@/lib/auth/get-current-user";

export default async function Page() {
  const ctx = await getAuthContext();
  return <MembersPage currentUserId={ctx.userId} currentRole={ctx.role} />;
}
