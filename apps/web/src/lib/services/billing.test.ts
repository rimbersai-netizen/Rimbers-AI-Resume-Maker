import { vi } from "vitest";
vi.mock("server-only", () => ({}));
import { describe, expect, it } from "vitest";
import { addPeriod, startCheckout, syncInvoice, syncPending, webhookInvoiceId, webhookTokenValid } from "./billing";

/** Tiny in-memory stand-in for the Supabase query builder (only what billing uses). */
function fakeDb(seed: Record<string, Record<string, any>[]>) {
  const t = seed;
  const q = (name: string) => {
    let rows = () => t[name] ?? (t[name] = []);
    const filters: ((r: any) => boolean)[] = [];
    let mode: "select" | "insert" | "update" = "select", payload: any, lim = Infinity, order: [string, boolean] | null = null;
    const run = (): { data: any; error: any } => {
      const hit = rows().filter((r) => filters.every((f) => f(r)));
      if (mode === "insert") {
        const row = { id: `id${rows().length + 1}`, created_at: new Date().toISOString(), ...payload };
        const uniq = name === "subscriptions" ? ["provider", "provider_subscription_id"] : name === "payments" ? ["idempotency_key"] : [];
        if (uniq.length && rows().some((r) => uniq.every((k) => r[k] === row[k]))) return { data: null, error: { code: "23505" } };
        rows().push(row); return { data: row, error: null };
      }
      if (mode === "update") { hit.forEach((r) => Object.assign(r, payload)); return { data: hit, error: null }; }
      let out = [...hit];
      if (order) out.sort((a, b) => (a[order![0]] < b[order![0]] ? 1 : -1) * (order![1] ? -1 : 1));
      return { data: out.slice(0, lim), error: null };
    };
    const b: any = {
      select: () => b, insert: (p: any) => { mode = "insert"; payload = p; return b; }, update: (p: any) => { mode = "update"; payload = p; return b; },
      eq: (k: string, v: any) => { filters.push((r) => r[k] === v); return b; }, in: (k: string, v: any[]) => { filters.push((r) => v.includes(r[k])); return b; },
      order: (k: string, o?: { ascending: boolean }) => { order = [k, o?.ascending ?? true]; return b; }, limit: (n: number) => { lim = n; return b; },
      maybeSingle: async () => ({ data: run().data?.[0] ?? null, error: null }),
      single: async () => { const r = run(); const d = Array.isArray(r.data) ? r.data[0] : r.data; return { data: d ?? null, error: r.error ?? (d ? null : { code: "PGRST116" }) }; },
      then: (res: any, rej: any) => Promise.resolve(run()).then(res, rej),
    };
    return b;
  };
  return { from: q, rpc: async () => ({ data: null, error: null }), tables: t } as any;
}

const USER = { id: "u1" } as any;
const plans = [{ id: "STANDARD", name: "Standard", is_active: true, currency: "SAR", monthly_price_minor: 1900, yearly_price_minor: 15900, sort_order: 1 }, { id: "FREE", name: "Free", is_active: true, currency: "SAR", monthly_price_minor: 0, yearly_price_minor: 0, sort_order: 0 }];
const NOW = new Date("2026-11-24T00:00:00Z");
const base = { secretKey: "sk_test_x", siteUrl: "https://app.example.com", now: () => NOW };

function mockMoyasar(handler: (url: string, init: any) => any) {
  const calls: { url: string; init: any }[] = [];
  const fetchImpl = (async (url: string, init: any) => { calls.push({ url, init }); const r = handler(url, init); return new Response(JSON.stringify(r.body), { status: r.status ?? 200 }); }) as never;
  return { fetchImpl, calls };
}

describe("startCheckout", () => {
  it("charges the server-side price, never a client amount, and authenticates with the secret key", async () => {
    const m = mockMoyasar(() => ({ body: { id: "inv_abc12345", status: "initiated", url: "https://checkout.moyasar.com/invoices/inv_abc12345" } }));
    const supa = fakeDb({ subscription_plans: plans }), admin = fakeDb({ payments: [] });
    const r = await startCheckout(supa, admin, USER, { plan: "STANDARD", period: "monthly", amount: 1 }, { ...base, fetchImpl: m.fetchImpl });
    expect(r.ok && r.value.amount).toBe(1900);
    const sent = JSON.parse(m.calls[0]!.init.body);
    expect(sent).toMatchObject({ amount: 1900, currency: "SAR", metadata: { user_id: "u1", plan_id: "STANDARD", period: "monthly" } });
    expect(sent.callback_url).toBe("https://app.example.com/api/webhooks/moyasar");
    expect(m.calls[0]!.init.headers.Authorization).toBe(`Basic ${Buffer.from("sk_test_x:").toString("base64")}`);
    expect(admin.tables.payments[0]).toMatchObject({ user_id: "u1", status: "initiated", amount_minor: 1900, provider_payment_id: "inv_inv_abc12345" });
  });
  it("rejects free/unknown plans and omits the webhook URL on plain http", async () => {
    const supa = fakeDb({ subscription_plans: plans }), admin = fakeDb({ payments: [] });
    expect((await startCheckout(supa, admin, USER, { plan: "FREE", period: "monthly" }, base)).ok).toBe(false);
    expect((await startCheckout(supa, admin, USER, { plan: "GOLD", period: "monthly" }, base)).ok).toBe(false);
    const m = mockMoyasar(() => ({ body: { id: "inv_http1234", url: "https://checkout.moyasar.com/x" } }));
    await startCheckout(supa, admin, USER, { plan: "STANDARD", period: "yearly" }, { ...base, siteUrl: "http://192.168.1.5:3100", fetchImpl: m.fetchImpl });
    expect(JSON.parse(m.calls[0]!.init.body).callback_url).toBeUndefined();
    expect(JSON.parse(m.calls[0]!.init.body).amount).toBe(15900);
  });
  it("does not leak Moyasar errors to the user", async () => {
    const m = mockMoyasar(() => ({ status: 401, body: { message: "Invalid authorization credentials" } }));
    const r = await startCheckout(fakeDb({ subscription_plans: plans }), fakeDb({ payments: [] }), USER, { plan: "STANDARD", period: "monthly" }, { ...base, fetchImpl: m.fetchImpl });
    expect(r).toMatchObject({ ok: false, message: "Could not start the payment. Please try again." });
  });
});

describe("syncInvoice", () => {
  const invoice = (over: any = {}) => ({ id: "inv_abc12345", status: "paid", amount: 1900, currency: "SAR", metadata: { user_id: "u1", plan_id: "STANDARD", period: "monthly" }, payments: [{ id: "pay_1", status: "paid", amount: 1900, currency: "SAR" }], ...over });
  const dbWithPayment = () => fakeDb({ payments: [{ id: "p1", user_id: "u1", provider: "moyasar", provider_payment_id: "inv_inv_abc12345", idempotency_key: "moyasar:invoice:inv_abc12345", status: "initiated", amount_minor: 1900, currency: "SAR", subscription_id: null }], subscriptions: [] });

  it("activates the plan once, even when the redirect and webhook race", async () => {
    const admin = dbWithPayment();
    const m = mockMoyasar(() => ({ body: invoice() }));
    const a = await syncInvoice(admin, "inv_abc12345", { ...base, fetchImpl: m.fetchImpl }, "u1");
    const b = await syncInvoice(admin, "inv_abc12345", { ...base, fetchImpl: m.fetchImpl });
    expect(a.ok && a.value.status).toBe("paid");
    expect(b.ok && b.value.status).toBe("paid");
    expect(admin.tables.subscriptions).toHaveLength(1);
    expect(admin.tables.subscriptions[0]).toMatchObject({ plan_id: "STANDARD", status: "active", provider: "moyasar", current_period_end: addPeriod(NOW, "monthly").toISOString() });
    expect(admin.tables.payments[0]).toMatchObject({ status: "paid", provider_payment_id: "pay_1" });
  });
  it("does not activate when the amount differs from what we charged", async () => {
    const admin = dbWithPayment();
    const m = mockMoyasar(() => ({ body: invoice({ amount: 100, payments: [{ id: "pay_1", status: "paid", amount: 100, currency: "SAR" }] }) }));
    const r = await syncInvoice(admin, "inv_abc12345", { ...base, fetchImpl: m.fetchImpl });
    expect(r.ok).toBe(false);
    expect(admin.tables.subscriptions).toHaveLength(0);
  });
  it("rejects another user's invoice and unknown invoices", async () => {
    const admin = dbWithPayment();
    const m = mockMoyasar(() => ({ body: invoice() }));
    expect((await syncInvoice(admin, "inv_abc12345", { ...base, fetchImpl: m.fetchImpl }, "someone-else")).ok).toBe(false);
    const forged = mockMoyasar(() => ({ body: invoice({ id: "inv_forged999", metadata: { user_id: "u1", plan_id: "PREMIUM", period: "yearly" } }) }));
    expect((await syncInvoice(admin, "inv_forged999", { ...base, fetchImpl: forged.fetchImpl })).ok).toBe(false);
    expect(admin.tables.subscriptions).toHaveLength(0);
  });
  it("leaves unpaid invoices pending and marks cancelled ones failed", async () => {
    const admin = dbWithPayment();
    const pend = mockMoyasar(() => ({ body: invoice({ status: "initiated", payments: [] }) }));
    expect(await syncInvoice(admin, "inv_abc12345", { ...base, fetchImpl: pend.fetchImpl })).toMatchObject({ ok: true, value: { status: "pending" } });
    const failed = mockMoyasar(() => ({ body: invoice({ status: "failed", payments: [{ id: "pay_1", status: "failed", amount: 1900, currency: "SAR" }] }) }));
    expect(await syncInvoice(admin, "inv_abc12345", { ...base, fetchImpl: failed.fetchImpl })).toMatchObject({ ok: true, value: { status: "failed" } });
    expect(admin.tables.payments[0]!.status).toBe("failed");
    expect(admin.tables.subscriptions).toHaveLength(0);
  });
  it("extends from the current period end when paying again early", async () => {
    const admin = dbWithPayment();
    const end = new Date("2026-12-10T00:00:00Z");
    admin.tables.subscriptions.push({ id: "old", user_id: "u1", plan_id: "STANDARD", status: "active", provider: "moyasar", provider_subscription_id: "inv_old", current_period_end: end.toISOString() });
    const m = mockMoyasar(() => ({ body: invoice() }));
    await syncInvoice(admin, "inv_abc12345", { ...base, fetchImpl: m.fetchImpl });
    expect(admin.tables.subscriptions[1]).toMatchObject({ current_period_start: end.toISOString(), current_period_end: addPeriod(end, "monthly").toISOString() });
  });
  it("syncPending finds the user's unfinished checkout", async () => {
    const admin = dbWithPayment();
    const m = mockMoyasar(() => ({ body: invoice() }));
    expect(await syncPending(admin, "u1", { ...base, fetchImpl: m.fetchImpl })).toMatchObject({ status: "paid", plan: "STANDARD" });
  });
  it("refunds expire the plan", async () => {
    const admin = dbWithPayment();
    const m1 = mockMoyasar(() => ({ body: invoice() }));
    await syncInvoice(admin, "inv_abc12345", { ...base, fetchImpl: m1.fetchImpl });
    const m2 = mockMoyasar(() => ({ body: invoice({ status: "refunded", payments: [{ id: "pay_1", status: "refunded", amount: 1900, refunded: 1900, currency: "SAR" }] }) }));
    expect(await syncInvoice(admin, "inv_abc12345", { ...base, fetchImpl: m2.fetchImpl })).toMatchObject({ ok: true, value: { status: "refunded" } });
    expect(admin.tables.subscriptions[0]!.status).toBe("expired");
    expect(admin.tables.payments[0]).toMatchObject({ status: "refunded", refunded_amount_minor: 1900 });
  });
});

describe("webhook helpers", () => {
  it("accepts only the configured shared secret (constant-time compare)", () => {
    expect(webhookTokenValid("s3cret", "s3cret")).toBe(true);
    expect(webhookTokenValid("s3creT", "s3cret")).toBe(false);
    expect(webhookTokenValid("short", "s3cret")).toBe(false);
    expect(webhookTokenValid(undefined, "s3cret")).toBe(false);
    expect(webhookTokenValid("anything", "")).toBe(false); // no secret configured → nothing is trusted
  });
  it("extracts the invoice id only from payment/invoice objects", () => {
    expect(webhookInvoiceId({ data: { invoice_id: "inv_1" } })).toBe("inv_1");
    expect(webhookInvoiceId({ data: { id: "inv_2", object: "invoice" } })).toBe("inv_2");
    expect(webhookInvoiceId({ data: { id: "pay_3" } })).toBeNull();
    expect(webhookInvoiceId(null)).toBeNull();
  });
});
