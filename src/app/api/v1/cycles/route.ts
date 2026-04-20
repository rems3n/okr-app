import { z } from "zod";

import { withAuth } from "@/lib/api/with-auth";
import { BadRequestError } from "@/lib/errors";

export const GET = withAuth({
  handler: async ({ db }) => {
    return db.listCycles();
  },
});

const CreateInput = z.object({
  name: z.string().min(1).max(120),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
});

export const POST = withAuth({
  require: "org.manage",
  input: CreateInput,
  handler: async ({ db, input }) => {
    if (input.startDate >= input.endDate) {
      throw new BadRequestError("endDate must be after startDate");
    }
    return db.createCycle({
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
    });
  },
});
