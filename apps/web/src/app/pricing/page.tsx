import { redirect } from "next/navigation";
import { DEFAULT_PLAN_LIMITS } from "@gars/subscriptions";
import { createClient } from "@/lib/supabase/server";
import { entitlement } from "@/lib/entitlements";
import { loadPlanPrices } from "@/lib/services/billing";
import { Plans } from "./plans";

export const metadata = { title: "Plans · Rimbers AI Resume Maker" };
export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/pricing");
  const [prices, current] = await Promise.all([loadPlanPrices(supabase), entitlement(supabase, "create_resume")]);
  return (
    <main className="home">
      <h1>Plans</h1>
      <p className="muted">Pay securely with Moyasar (cards, mada, Apple Pay). Each payment covers one period — pay again to renew. Limits below are enforced by our servers.</p>
      <Plans prices={prices} current={current.plan} limits={DEFAULT_PLAN_LIMITS} />
    </main>
  );
}
