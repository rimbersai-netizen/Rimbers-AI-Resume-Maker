/**
 * Plans, quotas and entitlement evaluation. Pure and deterministic: the SERVER loads rows
 * (subscriptions, entitlements, usage_quotas) and calls these functions; clients only display results.
 */
import type { PlanId } from "@gars/shared-types";

export interface PlanLimits {
  resumes: number | null;            // null = unlimited
  ai_requests_month: number | null;
  exports_month: number | null;
  docx: boolean;
  premium_templates: boolean;
  /** AI interview preparation — Professional and above. */
  interview_prep: boolean;
}

/** Mirrors supabase/seed.sql (DB is the source of truth at runtime; these are defaults + tests). */
export const DEFAULT_PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  FREE:         { resumes: 1,    ai_requests_month: 5,   exports_month: 2,    docx: false, premium_templates: false, interview_prep: false },
  STANDARD:     { resumes: 5,    ai_requests_month: 50,  exports_month: 20,   docx: true,  premium_templates: false, interview_prep: false },
  PROFESSIONAL: { resumes: 20,   ai_requests_month: 200, exports_month: 100,  docx: true,  premium_templates: true,  interview_prep: true },
  PREMIUM:      { resumes: null, ai_requests_month: 500, exports_month: null, docx: true,  premium_templates: true,  interview_prep: true },
};

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "expired";
export interface SubscriptionRow {
  plan_id: PlanId;
  status: SubscriptionStatus;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}
export interface EntitlementRow {
  feature: string;
  source: "plan" | "one_time" | "coupon" | "admin_grant" | "trial";
  valid_from: string;
  valid_until: string | null;
}

export const PAST_DUE_GRACE_DAYS = 3;

/** Which plan governs access right now. Canceled-at-period-end keeps access until the period ends. */
export function effectivePlan(subs: SubscriptionRow[], now: Date): PlanId {
  const order: PlanId[] = ["PREMIUM", "PROFESSIONAL", "STANDARD", "FREE"];
  const active = subs.filter((s) => {
    const end = s.current_period_end ? new Date(s.current_period_end) : null;
    switch (s.status) {
      case "active": case "trialing": return !end || end > now;
      case "past_due": return !!end && now.getTime() < end.getTime() + PAST_DUE_GRACE_DAYS * 86_400_000;
      case "canceled": return !!end && end > now; // paid-through period honoured
      case "expired": return false;
    }
  });
  for (const p of order) if (active.some((s) => s.plan_id === p)) return p;
  return "FREE";
}

export type Feature = "create_resume" | "ai_request" | "export_pdf" | "export_docx" | "premium_template" | "interview_prep";

export interface Decision {
  allowed: boolean;
  reason: "ok" | "plan_feature" | "quota_exhausted" | "one_time_entitlement";
  plan: PlanId;
  remaining: number | null;
  upgradeTo?: PlanId;
}

export interface EvaluateInput {
  subscriptions: SubscriptionRow[];
  entitlements: EntitlementRow[];
  usage: { resumes: number; ai_requests_month: number; exports_month: number };
  now: Date;
  limits?: Record<PlanId, PlanLimits>;
}

const activeEnt = (e: EntitlementRow[], feature: string, now: Date) =>
  e.some((x) => x.feature === feature && new Date(x.valid_from) <= now && (!x.valid_until || new Date(x.valid_until) > now));

function upgradeFor(feature: Feature, plan: PlanId, limits: Record<PlanId, PlanLimits>): PlanId | undefined {
  const ladder: PlanId[] = ["FREE", "STANDARD", "PROFESSIONAL", "PREMIUM"];
  return ladder.slice(ladder.indexOf(plan) + 1).find((p) => {
    const l = limits[p];
    if (feature === "export_docx") return l.docx;
    if (feature === "premium_template") return l.premium_templates;
    if (feature === "interview_prep") return l.interview_prep;
    return true;
  });
}

export function evaluate(feature: Feature, input: EvaluateInput): Decision {
  const limits = input.limits ?? DEFAULT_PLAN_LIMITS;
  const plan = effectivePlan(input.subscriptions, input.now);
  const l = limits[plan];
  const quota = (limit: number | null, used: number): Decision =>
    limit === null ? { allowed: true, reason: "ok", plan, remaining: null }
      : used < limit ? { allowed: true, reason: "ok", plan, remaining: limit - used - 1 }
      : { allowed: false, reason: "quota_exhausted", plan, remaining: 0, upgradeTo: upgradeFor(feature, plan, limits) };

  switch (feature) {
    case "create_resume": return quota(l.resumes, input.usage.resumes);
    case "ai_request": return quota(l.ai_requests_month, input.usage.ai_requests_month);
    case "export_pdf":
    case "export_docx": {
      if (feature === "export_docx" && !l.docx) {
        if (activeEnt(input.entitlements, "export_docx", input.now)) return { allowed: true, reason: "one_time_entitlement", plan, remaining: null };
        return { allowed: false, reason: "plan_feature", plan, remaining: 0, upgradeTo: upgradeFor(feature, plan, limits) };
      }
      const d = quota(l.exports_month, input.usage.exports_month);
      if (!d.allowed && activeEnt(input.entitlements, "export_download", input.now)) return { allowed: true, reason: "one_time_entitlement", plan, remaining: null };
      return d;
    }
    case "interview_prep":
      if (l.interview_prep) return quota(l.ai_requests_month, input.usage.ai_requests_month);
      return { allowed: false, reason: "plan_feature", plan, remaining: 0, upgradeTo: upgradeFor(feature, plan, limits) };
    case "premium_template":
      if (l.premium_templates || activeEnt(input.entitlements, "premium_templates", input.now)) return { allowed: true, reason: "ok", plan, remaining: null };
      return { allowed: false, reason: "plan_feature", plan, remaining: 0, upgradeTo: upgradeFor(feature, plan, limits) };
  }
}

/** Monthly quota period key (UTC calendar month) for usage_quotas.period_start. */
export const periodStart = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);

/** Apply a coupon to a price in minor units. Never below zero. */
export function applyCoupon(priceMinor: number, c: { percent_off?: number | null; amount_off_minor?: number | null }): number {
  if (c.percent_off) return Math.max(0, Math.round(priceMinor * (100 - c.percent_off) / 100));
  if (c.amount_off_minor) return Math.max(0, priceMinor - c.amount_off_minor);
  return priceMinor;
}
