import { preflight, json } from "@/lib/api-auth";
import { route } from "@/lib/api-route";
import { deleteComment } from "@/lib/services/community";

export const OPTIONS = preflight;

export const DELETE = route<{ id: string }>(async ({ supabase, params }) => json({ ok: await deleteComment(supabase, params.id) }));
