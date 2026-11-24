import { preflight, json } from "@/lib/api-auth";
import { route } from "@/lib/api-route";
import { getFeed } from "@/lib/services/jobs";

export const OPTIONS = preflight;

/** GET ?offset&limit -> jobs from public feeds, filtered by saved preferences and ranked by an explainable match score. */
export const GET = route(async ({ supabase, user, query }) => {
  try {
    const r = await getFeed(supabase, user, { offset: Number(query.get("offset") ?? 0) || 0, limit: Number(query.get("limit") ?? 20) || 20 });
    return json({ ok: true, ...r });
  } catch (e) {
    if (e instanceof Error && /unreachable/.test(e.message)) return json({ ok: false, kind: "error", message: "Job listings are unavailable right now. Please try again shortly." }, 503);
    throw e;
  }
});
