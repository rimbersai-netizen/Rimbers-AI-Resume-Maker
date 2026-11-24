import { preflight } from "@/lib/api-auth";
import { body, result, route } from "@/lib/api-route";
import { applyTailoring } from "@/lib/services/jobs";

export const OPTIONS = preflight;

/** POST { key, addSkills[], tailorSummary } -> creates a resume for the role and queues the fact-checked summary. */
export const POST = route(async ({ req, supabase, user }) => result(await applyTailoring(supabase, user, await body(req))));
