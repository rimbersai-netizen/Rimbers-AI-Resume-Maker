import { describe, expect, it } from "vitest";
import { applyCoupon, effectivePlan, evaluate, periodStart, type SubscriptionRow } from "./index";

const now = new Date("2026-11-21T12:00:00Z");
const sub = (o: Partial<SubscriptionRow>): SubscriptionRow => ({ plan_id: "PROFESSIONAL", status: "active", current_period_end: "2026-12-21T00:00:00Z", cancel_at_period_end: false, ...o });
const base = { entitlements: [], usage: { resumes: 0, ai_requests_month: 0, exports_month: 0 }, now };

describe("effectivePlan", () => {
  it("no subscription → FREE", () => expect(effectivePlan([], now)).toBe("FREE"));
  it("active → plan", () => expect(effectivePlan([sub({})], now)).toBe("PROFESSIONAL"));
  it("canceled keeps access until period end (workflow G)", () => {
    expect(effectivePlan([sub({ status: "canceled", cancel_at_period_end: true })], now)).toBe("PROFESSIONAL");
    expect(effectivePlan([sub({ status: "canceled", current_period_end: "2026-11-20T00:00:00Z" })], now)).toBe("FREE");
  });
  it("past_due has a 3-day grace period", () => {
    expect(effectivePlan([sub({ status: "past_due", current_period_end: "2026-11-20T00:00:00Z" })], now)).toBe("PROFESSIONAL");
    expect(effectivePlan([sub({ status: "past_due", current_period_end: "2026-11-15T00:00:00Z" })], now)).toBe("FREE");
  });
  it("expired → FREE; highest active plan wins", () => {
    expect(effectivePlan([sub({ status: "expired" })], now)).toBe("FREE");
    expect(effectivePlan([sub({ plan_id: "STANDARD" }), sub({ plan_id: "PREMIUM" })], now)).toBe("PREMIUM");
  });
});

describe("evaluate", () => {
  it("FREE: 1 resume, then blocked with upgrade hint", () => {
    expect(evaluate("create_resume", { ...base, subscriptions: [] })).toMatchObject({ allowed: true, remaining: 0 });
    expect(evaluate("create_resume", { ...base, subscriptions: [], usage: { ...base.usage, resumes: 1 } })).toMatchObject({ allowed: false, reason: "quota_exhausted", upgradeTo: "STANDARD" });
  });
  it("FREE cannot export DOCX; STANDARD can", () => {
    expect(evaluate("export_docx", { ...base, subscriptions: [] })).toMatchObject({ allowed: false, reason: "plan_feature", upgradeTo: "STANDARD" });
    expect(evaluate("export_docx", { ...base, subscriptions: [sub({ plan_id: "STANDARD" })] }).allowed).toBe(true);
  });
  it("one-time DOCX entitlement works for FREE users while valid", () => {
    const e = [{ feature: "export_docx", source: "one_time" as const, valid_from: "2026-11-01T00:00:00Z", valid_until: "2026-11-22T00:00:00Z" }];
    expect(evaluate("export_docx", { ...base, subscriptions: [], entitlements: e })).toMatchObject({ allowed: true, reason: "one_time_entitlement" });
    expect(evaluate("export_docx", { ...base, subscriptions: [], entitlements: e, now: new Date("2026-11-23T00:00:00Z") }).allowed).toBe(false);
  });
  it("premium templates need PROFESSIONAL+", () => {
    expect(evaluate("premium_template", { ...base, subscriptions: [sub({ plan_id: "STANDARD" })] })).toMatchObject({ allowed: false, upgradeTo: "PROFESSIONAL" });
    expect(evaluate("premium_template", { ...base, subscriptions: [sub({})] }).allowed).toBe(true);
  });
  it("PREMIUM exports are unlimited", () => expect(evaluate("export_pdf", { ...base, subscriptions: [sub({ plan_id: "PREMIUM" })], usage: { ...base.usage, exports_month: 9999 } })).toMatchObject({ allowed: true, remaining: null }));
  it("AI quota enforced", () => expect(evaluate("ai_request", { ...base, subscriptions: [], usage: { ...base.usage, ai_requests_month: 5 } }).allowed).toBe(false));
  it("cancellation → after period end, falls back to FREE limits", () => {
    const later = new Date("2026-12-22T00:00:00Z");
    expect(evaluate("export_docx", { ...base, now: later, subscriptions: [sub({ status: "canceled", cancel_at_period_end: true })] }).allowed).toBe(false);
  });
});

describe("helpers", () => {
  it("periodStart is UTC month start", () => expect(periodStart(new Date("2026-11-30T23:59:59Z"))).toBe("2026-11-01"));
  it("coupons never go negative", () => {
    expect(applyCoupon(3900, { percent_off: 25 })).toBe(2925);
    expect(applyCoupon(1000, { amount_off_minor: 5000 })).toBe(0);
  });
});
