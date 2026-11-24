import { preflight } from "@/lib/api-auth";
import { body, result, route } from "@/lib/api-route";
import { tailorAnalysis } from "@/lib/services/jobs";

export const OPTIONS = preflight;

/** POST { key } -> strengths / optimizations / gaps computed from the user's real profile. */
export const POST = route(async ({ req, supabase, user }) => {
  const b = await body(req);
  return result(await tailorAnalysis(supabase, user, typeof b?.key === "string" ? b.key : ""));
});
