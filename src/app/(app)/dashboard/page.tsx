import { getAuthContext } from "@/lib/auth/get-current-user";

export default async function DashboardPage() {
  const ctx = await getAuthContext();
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">
        Hello, {ctx.name}
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        Welcome to OKR App. The dashboard lands here in Sprint 3.
      </p>
    </div>
  );
}
