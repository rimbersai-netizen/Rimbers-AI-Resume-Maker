import { bearerAuth, json, preflight, unauthorized } from "@/lib/api-auth";
import { loadPrimaryProfileCore, saveProfileCore } from "@/lib/services/profile";

export const OPTIONS = preflight;

/** GET -> { id, updatedAt, profile } (primary master profile, created on first use). */
export async function GET(req: Request) {
  const auth = await bearerAuth(req);
  if (!auth) return unauthorized();
  try {
    return json({ ok: true, value: await loadPrimaryProfileCore(auth.supabase, auth.user) });
  } catch {
    return json({ ok: false, kind: "error", message: "Could not load your profile." }, 500);
  }
}

/** PUT { id, profile, expectedUpdatedAt, snapshotLabel? } -> SaveResult (validated by the shared Zod contract). */
export async function PUT(req: Request) {
  const auth = await bearerAuth(req);
  if (!auth) return unauthorized();
  const b = (await req.json().catch(() => null)) as { id?: string; profile?: unknown; expectedUpdatedAt?: string | null; snapshotLabel?: string } | null;
  if (!b?.id) return json({ ok: false, kind: "invalid", issues: {} }, 400);
  const r = await saveProfileCore(auth.supabase, b.id, b.profile, b.expectedUpdatedAt ?? null, b.snapshotLabel);
  return json(r, r.ok ? 200 : r.kind === "conflict" ? 409 : r.kind === "invalid" ? 422 : 500);
}
