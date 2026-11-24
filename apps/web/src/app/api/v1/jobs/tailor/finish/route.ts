import { preflight } from "@/lib/api-auth";
import { body, result, route } from "@/lib/api-route";
import { finishTailoring } from "@/lib/services/jobs";

export const OPTIONS = preflight;

/** POST { resumeId, aiJobId } -> stores the finished (fact-checked) summary on that resume only. */
export const POST = route(async ({ req, supabase }) => {
  const b = await body(req);
  return result(await finishTailoring(supabase, String(b?.resumeId ?? ""), String(b?.aiJobId ?? "")));
});
