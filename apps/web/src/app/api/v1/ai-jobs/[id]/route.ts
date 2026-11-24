import { bearerAuth, json, preflight, unauthorized } from "@/lib/api-auth";
import { cancelAi, getAiJobState } from "@/lib/services/ai";

export const OPTIONS = preflight;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await bearerAuth(req);
  if (!auth) return unauthorized();
  const s = await getAiJobState(auth.supabase, (await ctx.params).id);
  return s ? json(s) : json({ ok: false, message: "Not found" }, 404);
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await bearerAuth(req);
  if (!auth) return unauthorized();
  await cancelAi(auth.supabase, (await ctx.params).id);
  return json({ ok: true });
}
