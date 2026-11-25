import { json, preflight } from "@/lib/api-auth";
import { route } from "@/lib/api-route";
import { startResumeImport } from "@/lib/services/resume-import";

export const OPTIONS = preflight;

/** POST multipart (file, locale?) -> { ok, jobId }. Poll GET /ai-jobs/{id}; then POST /profile/import/apply. */
export const POST = route(async ({ req, supabase, user }) => {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return json({ ok: false, message: "Choose a PDF or Word file." }, 400);
  const locale = String(form?.get("locale") ?? "en");
  const r = await startResumeImport(supabase, user, { name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) }, /^[a-z]{2}(-[A-Za-z]+)?$/.test(locale) ? locale : "en");
  return json(r, r.ok ? 200 : r.upgrade ? 402 : 400);
});
