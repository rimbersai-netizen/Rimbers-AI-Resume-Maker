import { preflight, json } from "@/lib/api-auth";
import { route } from "@/lib/api-route";
import { deletePost, getPost } from "@/lib/services/community";

export const OPTIONS = preflight;

export const GET = route<{ id: string }>(async ({ supabase, user, params }) => {
  const r = await getPost(supabase, user, params.id);
  return r ? json({ ok: true, ...r }) : json({ ok: false, message: "Not found" }, 404);
});
export const DELETE = route<{ id: string }>(async ({ supabase, params }) => json({ ok: await deletePost(supabase, params.id) }));
