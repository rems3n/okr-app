import { NextResponse } from "next/server";
import { z, type ZodType } from "zod";

import { getAuthContext, type AuthContext } from "@/lib/auth/get-current-user";
import { can, type Action } from "@/lib/auth/permissions";
import { scopedDb, type ScopedDb } from "@/lib/db/scoped";
import { AppError, BadRequestError, ForbiddenError, toResponse } from "@/lib/errors";

type RouteParams = Record<string, string | string[] | undefined>;

export type HandlerContext<T, P extends RouteParams> = {
  ctx: AuthContext;
  db: ScopedDb;
  input: T;
  params: P;
};

type Options<T, P extends RouteParams, R> = {
  input?: ZodType<T>;
  require?: Action | Action[];
  handler: (context: HandlerContext<T, P>) => Promise<R>;
};

async function parseInput<T>(
  req: Request,
  schema: ZodType<T> | undefined,
): Promise<T | undefined> {
  if (!schema) return undefined;
  if (req.method === "GET" || req.method === "DELETE") {
    const url = new URL(req.url);
    const query: Record<string, string> = {};
    url.searchParams.forEach((v, k) => {
      query[k] = v;
    });
    const parsed = schema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestError(z.prettifyError(parsed.error));
    }
    return parsed.data;
  }
  let raw: unknown = undefined;
  try {
    raw = await req.json();
  } catch {
    throw new BadRequestError("Invalid JSON body");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new BadRequestError(z.prettifyError(parsed.error));
  }
  return parsed.data;
}

/**
 * Wrap a route handler with auth, org scoping, optional permission checks,
 * and Zod input parsing. Works for both static and `[param]` routes — when
 * used in a dynamic segment, Next.js passes `{ params: Promise<...> }` as
 * the second argument and we await it.
 */
export function withAuth<
  T = undefined,
  P extends RouteParams = RouteParams,
  R = unknown,
>(opts: Options<T, P, R>) {
  return async (
    req: Request,
    context?: { params?: Promise<P> },
  ): Promise<NextResponse> => {
    try {
      const ctx = await getAuthContext();
      const required = Array.isArray(opts.require)
        ? opts.require
        : opts.require
          ? [opts.require]
          : [];
      for (const action of required) {
        if (!can(ctx.role, action)) throw new ForbiddenError();
      }
      const input = (await parseInput<T>(req, opts.input)) as T;
      const params = ((await context?.params) ?? {}) as P;
      const data = await opts.handler({
        ctx,
        db: scopedDb(ctx.orgId),
        input,
        params,
      });
      return NextResponse.json({ data });
    } catch (err) {
      if (err instanceof AppError) return toResponse(err);
      return toResponse(err);
    }
  };
}
