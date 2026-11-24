import { preflight } from "@/lib/api-auth";
import { body, result, route } from "@/lib/api-route";
import { addComment } from "@/lib/services/community";

export const OPTIONS = preflight;

export const POST = route<{ id: string }>(async ({ req, supabase, user, params }) => result(await addComment(supabase, user, params.id, await body(req))));
