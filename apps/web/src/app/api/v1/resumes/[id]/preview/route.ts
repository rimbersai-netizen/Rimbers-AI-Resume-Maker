import { bearerAuth, CORS, unauthorized } from "@/lib/api-auth";
import { loadRenderInputs, previewHtml } from "@/lib/services/render";

export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });

/** GET -> the resume rendered by the shared template engine (same HTML as web preview and the PDF worker). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await bearerAuth(req);
  if (!auth) return unauthorized();
  const r = await loadRenderInputs(auth.supabase, (await ctx.params).id);
  if (!r) return new Response("Not found", { status: 404, headers: CORS });
  return new Response(previewHtml(r, new URL(req.url).origin), { headers: { ...CORS, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
