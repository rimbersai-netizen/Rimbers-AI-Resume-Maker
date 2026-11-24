import Link from "next/link";
import { redirect } from "next/navigation";
import { adminClient } from "@/lib/admin-client";
import { createClient } from "@/lib/supabase/server";
import { syncPending, type SyncResult } from "@/lib/services/billing";

export const metadata = { title: "Payment · Rimbers AI Resume Maker" };
export const dynamic = "force-dynamic";

/** Moyasar redirects here after the hosted page. The query string is never trusted: the payment is re-read from Moyasar. */
export default async function BillingSuccess() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/billing/success");
  const r: SyncResult = await syncPending(adminClient(), user.id).catch(() => ({ status: "pending" as const }));
  return (
    <main className="shell"><section className="card" aria-live="polite">
      {r.status === "paid" ? (<><h1>Payment received ✓</h1><p className="sub">Your {r.plan?.toLowerCase()} plan is active{r.periodEnd ? ` until ${new Date(r.periodEnd).toLocaleDateString()}` : ""}. You can return to the app.</p><Link className="btn" href="/dashboard">Go to home</Link></>)
        : r.status === "failed" ? (<><h1>Payment not completed</h1><p className="sub">No money was taken for this attempt. You can try again.</p><Link className="btn" href="/pricing">Back to plans</Link></>)
        : (<><h1>Confirming your payment…</h1><p className="sub">This can take a few seconds. Refresh this page, or return to the app and pull to refresh.</p><Link className="btn" href="/billing/success">Check again</Link></>)}
    </section></main>
  );
}
