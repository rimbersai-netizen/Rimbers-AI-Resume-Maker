import { preflight, json } from "@/lib/api-auth";
import { route } from "@/lib/api-route";
import { getPipelineJob, removeFromPipeline } from "@/lib/services/jobs";

export const OPTIONS = preflight;

export const GET = route<{ id: string }>(async ({ supabase, params }) => {
  const job = await getPipelineJob(supabase, params.id);
  return job ? json({ ok: true, job }) : json({ ok: false, message: "Not found" }, 404);
});
export const DELETE = route<{ id: string }>(async ({ supabase, params }) => json({ ok: await removeFromPipeline(supabase, params.id) }));
