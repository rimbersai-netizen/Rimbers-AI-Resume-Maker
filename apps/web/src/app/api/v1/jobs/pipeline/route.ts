import { preflight, json } from "@/lib/api-auth";
import { body, result, route } from "@/lib/api-route";
import { listPipeline, pipelineCounts, setJobState, STATES, type PipelineState } from "@/lib/services/jobs";

export const OPTIONS = preflight;

/** GET ?states=saved,applied -> the user's pipeline (passed jobs are excluded unless asked for). */
export const GET = route(async ({ supabase, query }) => {
  const states = (query.get("states") ?? "").split(",").filter((s): s is PipelineState => (STATES as readonly string[]).includes(s));
  const [items, counts] = await Promise.all([listPipeline(supabase, states), pipelineCounts(supabase)]);
  return json({ ok: true, items, counts });
});

/** POST { key, state, notes? } -> save / pass / mark applied (creates the row on first use). */
export const POST = route(async ({ req, supabase, user }) => result(await setJobState(supabase, user, await body(req))));
