import { getAuthContext } from "@/lib/auth/get-current-user";
import { scopedDb } from "@/lib/db/scoped";
import { NotFoundError } from "@/lib/errors";

export default async function GeneralSettingsPage() {
  const ctx = await getAuthContext();
  const org = await scopedDb(ctx.orgId).getOrganization();
  if (!org) throw new NotFoundError();

  return (
    <section className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-lg font-semibold">Organization</h2>
        <p className="text-sm text-zinc-500">
          Name and slug are managed in Clerk. Changes made there sync back here
          automatically.
        </p>
      </div>
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-zinc-500">Name</dt>
          <dd className="font-medium">{org.name}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Slug</dt>
          <dd className="font-mono text-zinc-700 dark:text-zinc-300">
            {org.slug}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Plan</dt>
          <dd className="font-medium capitalize">{org.plan}</dd>
        </div>
      </dl>
    </section>
  );
}
