import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { bearerAuth, json, unauthorized } from "./api-auth";
import type { ActionResult } from "./services/resumes";

export interface Ctx<P> { req: Request; supabase: SupabaseClient; user: User; params: P; query: URLSearchParams }

/** Authenticated route wrapper: bearer auth, and no leaked internals on unexpected errors. */
export function route<P = Record<string, never>>(fn: (c: Ctx<P>) => Promise<Response>) {
  return async (req: Request, c: { params: Promise<P> }): Promise<Response> => {
    const auth = await bearerAuth(req);
    if (!auth) return unauthorized();
    try {
      return await fn({ req, ...auth, params: (c ? await c.params : {}) as P, query: new URL(req.url).searchParams });
    } catch (e) {
      console.error("api error", req.method, new URL(req.url).pathname, e instanceof Error ? e.message : e);
      return json({ ok: false, kind: "error", message: "Something went wrong. Please try again." }, 500);
    }
  };
}

export const body = (req: Request) => req.json().catch(() => null) as Promise<Record<string, unknown> | null>;

const STATUS = { invalid: 400, auth: 401, entitlement: 402, conflict: 409, error: 500 } as const;
export function result<T>(r: ActionResult<T>): Response {
  return json(r, r.ok ? 200 : STATUS[r.kind]);
}
