import { preflight } from "@/lib/api-auth";
import { result, route } from "@/lib/api-route";
import { toggleLike } from "@/lib/services/community";

export const OPTIONS = preflight;

/** POST -> toggles the caller's like. */
export const POST = route<{ id: string }>(async ({ supabase, user, params }) => result(await toggleLike(supabase, user, params.id)));
