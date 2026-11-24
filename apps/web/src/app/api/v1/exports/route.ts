import { bearerAuth, json, preflight, unauthorized } from "@/lib/api-auth";
import { requestExportCore } from "@/lib/services/resumes";

export const OPTIONS = preflight;

/** POST { resumeId, format: "pdf" | "docx" } -> { ok, value: { id } } (server-side export quota). */
export async function POST(req: Request) {
  const auth = await bearerAuth(req);
  if (!auth) return unauthorized();
  const b = (await req.json().catch(() => null)) as { resumeId?: string; format?: "pdf" | "docx" } | null;
  const r = await requestExportCore(auth.supabase, auth.user, String(b?.resumeId ?? ""), b?.format as "pdf" | "docx");
  return json(r, r.ok ? 200 : r.kind === "entitlement" ? 402 : 400);
}
