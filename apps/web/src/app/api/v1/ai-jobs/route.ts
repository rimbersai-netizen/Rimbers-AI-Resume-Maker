import { bearerAuth, json, preflight, unauthorized } from "@/lib/api-auth";
import { requestAi } from "@/lib/services/ai";

export const OPTIONS = preflight;

/** POST { input: AiJobInput } -> { ok, jobId } (server-side AI quota). */
export async function POST(req: Request) {
  const auth = await bearerAuth(req);
  if (!auth) return unauthorized();
  const body = (await req.json().catch(() => null)) as { input?: unknown } | null;
  const r = await requestAi(auth.supabase, auth.user, body?.input);
  return json(r, r.ok ? 200 : r.upgrade ? 402 : 400);
}
