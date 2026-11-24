import { analyzeResume } from "@gars/ats-engine";
import { bearerAuth, json, preflight, unauthorized } from "@/lib/api-auth";
import { loadRenderInputs } from "@/lib/services/render";

export const OPTIONS = preflight;

/** POST { jobDescription? } -> explainable ATS analysis computed from the real resume content. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await bearerAuth(req);
  if (!auth) return unauthorized();
  const b = (await req.json().catch(() => null)) as { jobDescription?: string } | null;
  const jd = typeof b?.jobDescription === "string" ? b.jobDescription.slice(0, 20000) : undefined;
  const r = await loadRenderInputs(auth.supabase, (await ctx.params).id);
  if (!r) return json({ ok: false, message: "Not found" }, 404);
  const result = analyzeResume({ profile: r.doc.profile, template: r.template.ats, jobDescription: jd, hiddenItemIds: r.doc.hiddenItemIds });
  return json({ ok: true, result });
}
