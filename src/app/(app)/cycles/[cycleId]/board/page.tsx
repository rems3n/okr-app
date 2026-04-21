import { CycleBoardView } from "@/components/board/cycle-board-view";
import { getAuthContext } from "@/lib/auth/get-current-user";
import { loadCycleBoard } from "@/lib/cycle-board";
import { NotFoundError } from "@/lib/errors";

import { ShareControls } from "./share-controls";

type Params = Promise<{ cycleId: string }>;

export default async function CycleBoardPage({
  params,
}: {
  params: Params;
}) {
  const { cycleId } = await params;
  const ctx = await getAuthContext();
  const data = await loadCycleBoard(ctx.orgId, cycleId);
  if (!data) throw new NotFoundError();

  const isAdmin = ctx.role === "owner" || ctx.role === "admin";
  return (
    <div className="space-y-4">
      <div className="max-w-4xl mx-auto flex items-center justify-between print:hidden">
        <p className="text-xs text-zinc-500">
          Print-ready view. Use ⌘P / Ctrl+P to save as PDF.
        </p>
        {isAdmin && <ShareControls cycleId={cycleId} />}
      </div>
      <CycleBoardView data={data} />
    </div>
  );
}
