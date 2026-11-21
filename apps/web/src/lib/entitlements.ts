import "server-only";
import { evaluate, type EntitlementRow, type Feature, type SubscriptionRow } from "@gars/subscriptions";
import type { createClient } from "./supabase/server";

export const PLAN_NAMES: Record<string, string> = { STANDARD: "Standard", PROFESSIONAL: "Professional", PREMIUM: "Premium" };

/** Server-side entitlement decision from the user's own rows (RLS-scoped). Never trust the client. */
export async function entitlement(supabase: Awaited<ReturnType<typeof createClient>>, feature: Feature) {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const active = ["queued", "running", "succeeded"];
  const [subs, ents, resumes, exportsMonth, aiMonth] = await Promise.all([
    supabase.from("subscriptions").select("plan_id,status,current_period_end,cancel_at_period_end"),
    supabase.from("entitlements").select("feature,source,valid_from,valid_until"),
    supabase.from("resume_documents").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("document_exports").select("id", { count: "exact", head: true }).gte("created_at", monthStart).in("status", active),
    supabase.from("ai_jobs").select("id", { count: "exact", head: true }).gte("created_at", monthStart).in("status", active),
  ]);
  return evaluate(feature, {
    subscriptions: (subs.data ?? []) as SubscriptionRow[],
    entitlements: (ents.data ?? []) as EntitlementRow[],
    usage: { resumes: resumes.count ?? 0, ai_requests_month: aiMonth.count ?? 0, exports_month: exportsMonth.count ?? 0 },
    now,
  });
}
