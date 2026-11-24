import { bearerAuth, CORS, json, preflight } from "@/lib/api-auth";
import { templatePreview } from "@/lib/services/template-preview";

export const OPTIONS = preflight;

/** GET (bearer) -> standalone HTML of this template filled with the caller's profile (sample data if the profile is empty). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await bearerAuth(req);
  const origin = new URL(req.url).origin;
  const r = await templatePreview(auth?.supabase ?? null, auth?.user ?? null, (await ctx.params).id, origin);
  if (!r) return json({ ok: false, message: "Unknown template" }, 404);
  return new Response(r.html, { headers: { ...CORS, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, max-age=60", "X-Preview-Source": r.source } });
}
