import { preflight, json } from "@/lib/api-auth";
import { adminClient } from "@/lib/admin-client";
import { route } from "@/lib/api-route";
import { syncPending } from "@/lib/services/billing";

export const OPTIONS = preflight;

/** POST -> re-check this user's unfinished payments with Moyasar and activate the plan if paid. Idempotent. */
export const POST = route(async ({ user }) => json({ ok: true, ...(await syncPending(adminClient(), user.id)) }));
