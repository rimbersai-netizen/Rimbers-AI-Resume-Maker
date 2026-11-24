import { bearerAuth, json, preflight, unauthorized } from "@/lib/api-auth";
import { getExportCore } from "@/lib/services/resumes";

export const OPTIONS = preflight;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await bearerAuth(req);
  if (!auth) return unauthorized();
  const s = await getExportCore(auth.supabase, (await ctx.params).id);
  return s ? json(s) : json({ ok: false, message: "Not found" }, 404);
}
