import { preflight } from "@/lib/api-auth";
import { adminClient } from "@/lib/admin-client";
import { body, result, route } from "@/lib/api-route";
import { startCheckout } from "@/lib/services/billing";

export const OPTIONS = preflight;

/** POST { plan, period } -> { url } hosted Moyasar checkout. The server decides the price. */
export const POST = route(async ({ req, supabase, user }) => result(await startCheckout(supabase, adminClient(), user, await body(req))));
