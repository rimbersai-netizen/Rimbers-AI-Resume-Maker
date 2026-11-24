import { bearerAuth, json, preflight, unauthorized } from "@/lib/api-auth";
import { createResumeCore } from "@/lib/services/resumes";

export const OPTIONS = preflight;

/** POST { layout } -> { ok, value: { id } } (server-side resume + premium-template limits). */
export async function POST(req: Request) {
  const auth = await bearerAuth(req);
  if (!auth) return unauthorized();
  const b = (await req.json().catch(() => null)) as { layout?: never } | null;
  const r = await createResumeCore(auth.supabase, auth.user, b?.layout as never);
  return json(r, r.ok ? 200 : r.kind === "entitlement" ? 402 : r.kind === "invalid" ? 400 : 500);
}
