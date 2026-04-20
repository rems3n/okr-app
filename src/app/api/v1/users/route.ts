import { withAuth } from "@/lib/api/with-auth";

export const GET = withAuth({
  handler: async ({ db }) => {
    return db.listUsers();
  },
});
