import { json, preflight } from "@/lib/api-auth";
import { body, route } from "@/lib/api-route";
import { applyResumeImport } from "@/lib/services/resume-import";

export const OPTIONS = preflight;

/** POST { jobId, mode?: "replace" | "fill" } -> SaveResult. Saves the extracted profile after the user reviewed it. */
export const POST = route(async ({ req, supabase, user }) => {
  const b = await body(req);
  const r = await applyResumeImport(supabase, user, String(b?.jobId ?? ""), b?.mode === "fill" ? "fill" : "replace");
  return json(r, r.ok ? 200 : r.kind === "conflict" ? 409 : r.kind === "invalid" ? 422 : r.kind === "error" ? 500 : 400);
});
