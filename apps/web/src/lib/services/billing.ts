import { timingSafeEqual } from "node:crypto";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { z } from "zod";
import type { ActionResult } from "./resumes";

/**
 * Moyasar billing (hosted invoices). Card data never touches our servers.
 *  1. startCheckout: the SERVER picks the amount from `subscription_plans` and creates a Moyasar invoice; the client only gets its hosted URL.
 *  2. Payment is confirmed by FETCHING the invoice back from Moyasar with the secret key (never by trusting a redirect or webhook body).
 *  3. Activation is idempotent: one subscription row per invoice (unique provider+provider_subscription_id) and one payment row per payment.
 * Each paid period is a one-time charge; the plan ends at the period end unless the user pays again (no stored cards / auto-renewal).
 */

const API = "https://api.moyasar.com/v1";
export const PAID_PLANS = ["STANDARD", "PROFESSIONAL", "PREMIUM"] as const;
export const CheckoutInput = z.object({ plan: z.enum(PAID_PLANS), period: z.enum(["monthly", "yearly"]) });
export type Period = "monthly" | "yearly";

export interface MoyasarPayment { id: string; status: string; amount: number; currency: string; refunded?: number }
export interface MoyasarInvoice {
  id: string; status: string; amount: number; currency: string; url: string;
  metadata?: Record<string, string> | null; payments?: MoyasarPayment[];
}

export interface BillingDeps {
  fetchImpl?: typeof fetch;
  secretKey?: string;
  siteUrl?: string;
  now?: () => Date;
}

const secret = (d: BillingDeps) => {
  const k = d.secretKey ?? process.env.MOYASAR_SECRET_KEY;
  if (!k) throw new Error("MOYASAR_SECRET_KEY is not configured");
  return k;
};
const auth = (d: BillingDeps) => `Basic ${Buffer.from(`${secret(d)}:`).toString("base64")}`;

export const isLiveKey = (k: string | undefined) => Boolean(k?.startsWith("sk_live_"));

async function moyasar<T>(d: BillingDeps, path: string, init?: { method: "POST"; body: unknown }): Promise<T> {
  const res = await (d.fetchImpl ?? fetch)(`${API}${path}`, {
    method: init?.method ?? "GET",
    headers: { Authorization: auth(d), "Content-Type": "application/json", Accept: "application/json" },
    body: init ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Moyasar ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export interface PlanPrice { id: string; name: string; currency: string; monthly: number; yearly: number }

export async function loadPlanPrices(supabase: SupabaseClient): Promise<PlanPrice[]> {
  const { data } = await supabase.from("subscription_plans").select("id,name,currency,monthly_price_minor,yearly_price_minor,sort_order").eq("is_active", true).order("sort_order");
  return (data ?? []).map((p) => ({ id: p.id, name: p.name, currency: p.currency, monthly: p.monthly_price_minor ?? 0, yearly: p.yearly_price_minor ?? 0 }));
}

const priceFor = (p: PlanPrice, period: Period) => (period === "monthly" ? p.monthly : p.yearly);

export function addPeriod(from: Date, period: Period): Date {
  const d = new Date(from);
  if (period === "monthly") d.setUTCMonth(d.getUTCMonth() + 1); else d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d;
}

/** Create a hosted invoice for the signed-in user. `admin` writes the `initiated` payment row. */
export async function startCheckout(
  supabase: SupabaseClient, admin: SupabaseClient, user: User, input: unknown, d: BillingDeps = {},
): Promise<ActionResult<{ url: string; invoiceId: string; amount: number; currency: string }>> {
  const p = CheckoutInput.safeParse(input);
  if (!p.success) return { ok: false, kind: "invalid", message: "Choose a plan and a billing period." };
  const plans = await loadPlanPrices(supabase);
  const plan = plans.find((x) => x.id === p.data.plan);
  const amount = plan ? priceFor(plan, p.data.period) : 0;
  if (!plan || amount < 100) return { ok: false, kind: "error", message: "That plan is not available right now." };

  const site = (d.siteUrl ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  if (!/^https?:\/\//.test(site)) return { ok: false, kind: "error", message: "Billing is not configured on the server." };
  const label = `${plan.name} plan (${p.data.period})`;
  let inv: MoyasarInvoice;
  try {
    inv = await moyasar<MoyasarInvoice>(d, "/invoices", {
      method: "POST",
      body: {
        amount, currency: plan.currency, description: label,
        success_url: `${site}/billing/success`, back_url: `${site}/pricing`,
        ...(site.startsWith("https://") ? { callback_url: `${site}/api/webhooks/moyasar` } : {}), // Moyasar needs a public HTTPS callback
        metadata: { user_id: user.id, plan_id: plan.id, period: p.data.period },
      },
    });
  } catch (e) {
    console.error("moyasar invoice failed", (e as Error).message);
    return { ok: false, kind: "error", message: "Could not start the payment. Please try again." };
  }
  if (!inv.id || !/^https:\/\//.test(inv.url ?? "")) return { ok: false, kind: "error", message: "Could not start the payment. Please try again." };

  const row = await admin.from("payments").insert({
    user_id: user.id, provider: "moyasar", provider_payment_id: `inv_${inv.id}`, amount_minor: amount, currency: plan.currency,
    status: "initiated", idempotency_key: `moyasar:invoice:${inv.id}`,
  });
  if (row.error) return { ok: false, kind: "error", message: "Could not start the payment. Please try again." };
  return { ok: true, value: { url: inv.url, invoiceId: inv.id, amount, currency: plan.currency } };
}

export type SyncResult = { status: "paid" | "pending" | "failed" | "refunded"; plan?: string; periodEnd?: string };

/**
 * Re-read the invoice from Moyasar and apply it. Safe to call repeatedly (redirect page, mobile poll, webhook all do).
 * `expectUserId` (when known) must match the invoice's owner.
 */
export async function syncInvoice(admin: SupabaseClient, invoiceId: string, d: BillingDeps = {}, expectUserId?: string): Promise<ActionResult<SyncResult>> {
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(invoiceId)) return { ok: false, kind: "invalid", message: "Invalid payment reference." };
  let inv: MoyasarInvoice;
  try { inv = await moyasar<MoyasarInvoice>(d, `/invoices/${encodeURIComponent(invoiceId)}`); }
  catch (e) { console.error("moyasar fetch failed", (e as Error).message); return { ok: false, kind: "error", message: "Could not check the payment right now." }; }

  const { data: pay } = await admin.from("payments").select("id,user_id,status,amount_minor,currency,subscription_id").eq("provider", "moyasar").in("provider_payment_id", [`inv_${inv.id}`]).maybeSingle();
  const meta = inv.metadata ?? {};
  // The invoice must be one we created, for the user we created it for.
  const known = pay ?? (await admin.from("payments").select("id,user_id,status,amount_minor,currency,subscription_id").eq("idempotency_key", `moyasar:invoice:${inv.id}`).maybeSingle()).data;
  if (!known || known.user_id !== meta.user_id || (expectUserId && known.user_id !== expectUserId)) return { ok: false, kind: "invalid", message: "Unknown payment." };
  const planId = meta.plan_id as string, period = meta.period as Period;
  if (!(PAID_PLANS as readonly string[]).includes(planId) || (period !== "monthly" && period !== "yearly")) return { ok: false, kind: "invalid", message: "Unknown payment." };

  const payments = inv.payments ?? [];
  const paid = payments.find((x) => x.status === "paid");
  const refunded = payments.find((x) => x.status === "refunded" || (x.refunded ?? 0) > 0);

  if (refunded && !paid) {
    await admin.from("payments").update({ status: "refunded", refunded_amount_minor: Math.min(refunded.refunded ?? refunded.amount, known.amount_minor) }).eq("id", known.id);
    if (known.subscription_id) await admin.from("subscriptions").update({ status: "expired" }).eq("id", known.subscription_id);
    return { ok: true, value: { status: "refunded" } };
  }
  if (inv.status !== "paid" || !paid) {
    if (inv.status === "failed" || inv.status === "canceled" || inv.status === "expired" || inv.status === "voided") {
      if (known.status === "initiated") await admin.from("payments").update({ status: "failed" }).eq("id", known.id);
      return { ok: true, value: { status: "failed" } };
    }
    return { ok: true, value: { status: "pending" } };
  }

  // Amount must equal what we charged for this plan (guards against a tampered/mismatched invoice).
  if (inv.amount !== known.amount_minor || paid.amount !== known.amount_minor || inv.currency !== known.currency) {
    console.error("moyasar amount mismatch", inv.id);
    return { ok: false, kind: "error", message: "The payment did not match the order. Contact support." };
  }
  if (known.status === "paid" && known.subscription_id) {
    const { data: s } = await admin.from("subscriptions").select("plan_id,current_period_end").eq("id", known.subscription_id).maybeSingle();
    return { ok: true, value: { status: "paid", plan: s?.plan_id ?? planId, periodEnd: s?.current_period_end ?? undefined } };
  }

  const now = (d.now ?? (() => new Date()))();
  // Pay again before expiry → the new period starts when the current one ends.
  const { data: cur } = await admin.from("subscriptions").select("current_period_end").eq("user_id", known.user_id).eq("plan_id", planId).in("status", ["active", "trialing"]).order("current_period_end", { ascending: false }).limit(1).maybeSingle();
  const startsAt = cur?.current_period_end && new Date(cur.current_period_end) > now ? new Date(cur.current_period_end) : now;
  const endsAt = addPeriod(startsAt, period);

  // Unique (provider, provider_subscription_id) makes a concurrent webhook + redirect safe: the loser reads the winner's row.
  const ins = await admin.from("subscriptions").insert({
    user_id: known.user_id, plan_id: planId, status: "active", billing_period: period, provider: "moyasar", provider_subscription_id: inv.id,
    current_period_start: startsAt.toISOString(), current_period_end: endsAt.toISOString(),
  }).select("id,current_period_end").single();
  let sub = ins.data;
  if (ins.error) {
    if (ins.error.code !== "23505") return { ok: false, kind: "error", message: "Payment received but activation failed. Contact support." };
    sub = (await admin.from("subscriptions").select("id,current_period_end").eq("provider", "moyasar").eq("provider_subscription_id", inv.id).single()).data;
  }
  await admin.from("payments").update({ status: "paid", provider_payment_id: paid.id, subscription_id: sub?.id ?? null }).eq("id", known.id);
  await admin.rpc("write_audit_log", { p_action: "billing.paid", p_entity_type: "subscription", p_entity_id: sub?.id ?? null, p_metadata: { plan: planId, period, amount: inv.amount, invoice: inv.id } }).then(() => undefined, () => undefined);
  return { ok: true, value: { status: "paid", plan: planId, periodEnd: sub?.current_period_end ?? endsAt.toISOString() } };
}

/** Webhook authenticity: Moyasar echoes the shared `secret_token` configured in the dashboard. Compared in constant time. */
export function webhookTokenValid(given: unknown, expected = process.env.MOYASAR_WEBHOOK_SECRET): boolean {
  if (typeof given !== "string" || !expected) return false;
  const a = Buffer.from(given), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Invoice id referenced by a webhook body (we then re-fetch it; the body itself is never trusted for amounts or status). */
export function webhookInvoiceId(body: unknown): string | null {
  const data = (body as { data?: { invoice_id?: unknown; id?: unknown; object?: unknown } } | null)?.data;
  const id = data?.invoice_id ?? (typeof data?.id === "string" && data.object === "invoice" ? data.id : null);
  return typeof id === "string" ? id : null;
}

/** Sync this user's most recent unfinished checkouts (after the hosted page redirects back, and for the mobile "refresh"). */
export async function syncPending(admin: SupabaseClient, userId: string, d: BillingDeps = {}): Promise<SyncResult> {
  const { data } = await admin.from("payments").select("provider_payment_id").eq("user_id", userId).eq("provider", "moyasar").eq("status", "initiated").order("created_at", { ascending: false }).limit(3);
  let best: SyncResult = { status: "pending" };
  for (const r of data ?? []) {
    const id = String(r.provider_payment_id).replace(/^inv_/, "");
    const res = await syncInvoice(admin, id, d, userId);
    if (res.ok && res.value.status === "paid") return res.value;
    if (res.ok && res.value.status === "failed" && best.status === "pending") best = res.value;
  }
  // Nothing unfinished: if the latest Moyasar subscription is active, report it (e.g. the success page was refreshed).
  if ((data ?? []).length === 0) {
    const { data: s } = await admin.from("subscriptions").select("plan_id,current_period_end").eq("user_id", userId).eq("provider", "moyasar").eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (s?.current_period_end && new Date(s.current_period_end) > new Date()) return { status: "paid", plan: s.plan_id, periodEnd: s.current_period_end };
  }
  return best;
}
