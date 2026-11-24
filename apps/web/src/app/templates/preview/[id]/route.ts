import { createClient } from "@/lib/supabase/server";
import { templatePreview } from "@/lib/services/template-preview";

/** Cookie-session preview used by the website gallery's iframes. Public visitors get the sample persona. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const r = await templatePreview(supabase, user, (await ctx.params).id, new URL(req.url).origin);
  if (!r) return new Response("Unknown template", { status: 404 });
  return new Response(r.html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, max-age=60", "X-Preview-Source": r.source, "Content-Security-Policy": "script-src 'none'; frame-ancestors 'self'", "X-Frame-Options": "SAMEORIGIN" } });
}
