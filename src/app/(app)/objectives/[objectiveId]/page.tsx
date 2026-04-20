import { ObjectiveDetailPage } from "@/components/okr/objective-detail";
import { getAuthContext } from "@/lib/auth/get-current-user";

type Params = Promise<{ objectiveId: string }>;

export default async function Page({ params }: { params: Params }) {
  const { objectiveId } = await params;
  const ctx = await getAuthContext();
  return (
    <ObjectiveDetailPage
      objectiveId={objectiveId}
      currentUserId={ctx.userId}
      currentRole={ctx.role}
    />
  );
}
