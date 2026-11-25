import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { entitlement } from "@/lib/entitlements";
import { loadPrimaryProfile } from "../profile/actions";
import { InterviewPrep } from "./client";

export const metadata = { title: "Interview Prep · Rimbers AI Resume Maker" };
export const dynamic = "force-dynamic";

export default async function InterviewPrepPage({ searchParams }: { searchParams: Promise<{ role?: string; company?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/interview-prep");
  const [pro, profile, sp, { data: prefs }] = await Promise.all([
    entitlement(supabase, "interview_prep"), loadPrimaryProfile(), searchParams,
    supabase.from("profiles").select("app_locale").eq("id", user.id).maybeSingle(),
  ]);
  // Plan access is decided here (and enforced again when the request is queued and when the worker runs it).
  const isPro = pro.allowed || pro.reason === "quota_exhausted";

  if (!isPro) {
    return (
      <main className="page">
        <section className="card wide" aria-labelledby="ip-title">
          <h1 id="ip-title">🔒 Interview Prep is a Pro feature</h1>
          <p className="muted">Included in the Professional plan and above.</p>
          <ul>
            <li>Likely questions for your target role — behavioral, technical and situational</li>
            <li>A short tip on how to answer each one</li>
            <li>Talking points from <strong>your own</strong> experience — nothing invented</li>
            <li>Skills the job asks for that you should be ready to discuss honestly</li>
          </ul>
          <Link className="btn" href="/pricing">See plans</Link>
          <Link className="muted" href="/dashboard">← Dashboard</Link>
        </section>
      </main>
    );
  }
  return (
    <main className="page">
      <InterviewPrep masterProfileId={profile?.id ?? ""} locale={prefs?.app_locale ?? "en"} profileReady={Boolean(profile?.profile.personal.fullName)} initialRole={sp.role ?? ""} initialCompany={sp.company ?? ""} />
    </main>
  );
}
