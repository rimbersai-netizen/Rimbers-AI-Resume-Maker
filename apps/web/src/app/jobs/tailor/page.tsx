import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { tailorAnalysis } from "@/lib/services/jobs";
import { Tailor } from "./tailor";

export const metadata = { title: "Tailor resume · Global AI Resume Studio" };
export const dynamic = "force-dynamic";

export default async function TailorPage({ searchParams }: { searchParams: Promise<{ key?: string }> }) {
  const { key } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(`/jobs/tailor?key=${key ?? ""}`)}`);
  const r = key ? await tailorAnalysis(supabase, user, key) : null;
  return (
    <main className="page jobs-page">
      <Link href="/jobs/applied" className="muted">← Applications</Link>
      {!r || !r.ok ? <p className="alert error" role="alert">{r && !r.ok ? r.message : "No job selected."}</p> : <Tailor jobKey={key!} job={r.value.job} plan={r.value.plan} match={r.value.match} />}
    </main>
  );
}
