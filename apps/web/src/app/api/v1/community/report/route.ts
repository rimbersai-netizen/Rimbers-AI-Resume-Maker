import { preflight } from "@/lib/api-auth";
import { body, result, route } from "@/lib/api-route";
import { report } from "@/lib/services/community";

export const OPTIONS = preflight;

/** POST { postId | commentId, reason } */
export const POST = route(async ({ req, supabase, user }) => {
  const b = await body(req);
  return result(await report(supabase, user, { postId: b?.postId as string | undefined, commentId: b?.commentId as string | undefined, reason: String(b?.reason ?? "") }));
});
