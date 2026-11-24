import { bearerAuth, json, preflight, unauthorized } from "@/lib/api-auth";
import { loadRenderInputs } from "@/lib/services/render";
import { saveLayoutCore } from "@/lib/services/resumes";

export const OPTIONS = preflight;

/** GET -> { layout, updatedAt, photoUrl } for one of the caller's resumes. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await bearerAuth(req);
  if (!auth) return unauthorized();
  const r = await loadRenderInputs(auth.supabase, (await ctx.params).id);
  if (!r) return json({ ok: false, message: "Not found" }, 404);
  return json({ ok: true, layout: r.layout, updatedAt: r.updatedAt, photoUrl: r.photoUrl });
}

/** PUT { layout, expectedUpdatedAt } -> { ok, value: { updatedAt } }. */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await bearerAuth(req);
  if (!auth) return unauthorized();
  const b = (await req.json().catch(() => null)) as { layout?: unknown; expectedUpdatedAt?: string | null } | null;
  const r = await saveLayoutCore(auth.supabase, (await ctx.params).id, b?.layout, b?.expectedUpdatedAt ?? null);
  return json(r, r.ok ? 200 : r.kind === "conflict" ? 409 : r.kind === "entitlement" ? 402 : r.kind === "invalid" ? 422 : 500);
}
