import { preflight, json } from "@/lib/api-auth";
import { body, result, route } from "@/lib/api-route";
import { getPrefs, ROLES, ROLE_IDS, savePrefs } from "@/lib/services/jobs";

export const OPTIONS = preflight;
const roles = ROLE_IDS.map((id) => ({ id, label: ROLES[id].label, hint: ROLES[id].hint }));

export const GET = route(async ({ supabase }) => json({ ok: true, ...(await getPrefs(supabase)), roles }));
export const PUT = route(async ({ req, supabase, user }) => result(await savePrefs(supabase, user, await body(req))));
