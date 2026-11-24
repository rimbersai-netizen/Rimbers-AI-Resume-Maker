"use client";

import { useState } from "react";
import type { PlanLimits } from "@gars/subscriptions";
import { checkout } from "./actions";

type Price = { id: string; name: string; currency: string; monthly: number; yearly: number };
const fmt = (minor: number, cur: string) => `${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: minor % 100 ? 2 : 0 })} ${cur}`;
const n = (v: number | null) => (v == null ? "Unlimited" : String(v));

export function Plans({ prices, current, limits }: { prices: Price[]; current: string; limits: Record<string, PlanLimits> }) {
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const buy = async (id: string) => {
    setBusy(id); setErr(null);
    const r = await checkout(id, period); // redirects to the hosted payment page on success
    if (r?.message) { setErr(r.message); setBusy(null); }
  };
  return (
    <>
      <div className="jobs-tabs" role="group" aria-label="Billing period">
        {(["monthly", "yearly"] as const).map((p) => <a key={p} href="#" role="button" aria-current={period === p ? "page" : undefined} onClick={(e) => { e.preventDefault(); setPeriod(p); }}>{p === "monthly" ? "Monthly" : "Yearly"}</a>)}
      </div>
      {err && <p className="alert error" role="alert">{err}</p>}
      <div className="tools-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {prices.map((p) => {
          const l = limits[p.id]!;
          const price = period === "monthly" ? p.monthly : p.yearly;
          const mine = p.id === current;
          return (
            <div key={p.id} className="tool" style={{ justifyItems: "start", textAlign: "start", borderColor: mine ? "var(--brand-500)" : undefined, borderWidth: mine ? 2 : 1 }}>
              <strong style={{ fontSize: "1.2rem" }}>{p.name}{mine && <span className="badge" style={{ marginInlineStart: 8 }}>Current</span>}</strong>
              <span style={{ fontSize: "1.6rem", fontWeight: 800 }}>{price ? fmt(price, p.currency) : "Free"}<small> {price ? `/ ${period === "monthly" ? "month" : "year"}` : ""}</small></span>
              <small>Resumes: {n(l.resumes)} · AI requests/month: {n(l.ai_requests_month)} · Downloads/month: {n(l.exports_month)}<br />Editable Word: {l.docx ? "Yes" : "No"} · Premium templates: {l.premium_templates ? "Yes" : "No"}</small>
              {p.id !== "FREE" && <button type="button" className="btn" disabled={busy !== null || mine} onClick={() => buy(p.id)}>{busy === p.id ? "Opening payment…" : mine ? "Your plan" : `Pay ${fmt(price, p.currency)}`}</button>}
            </div>
          );
        })}
      </div>
    </>
  );
}
