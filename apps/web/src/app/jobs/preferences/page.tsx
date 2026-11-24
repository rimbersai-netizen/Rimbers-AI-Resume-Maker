import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPrefs, pipelineCounts, ROLES, ROLE_IDS } from "@/lib/services/jobs";
import { JobsNav } from "../bits";
import { PreferencesForm } from "./form";

export const metadata = { title: "Job preferences · Rimbers AI Resume Maker" };
export const dynamic = "force-dynamic";

export default async function PreferencesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/jobs/preferences");
  const [{ prefs, saved }, counts] = await Promise.all([getPrefs(supabase), pipelineCounts(supabase)]);
  return (
    <main className="page jobs-page">
      <Link href="/dashboard" className="muted">← Dashboard</Link>
      <h1>{saved ? "Job preferences" : "What are you looking for?"}</h1>
      <JobsNav active="preferences" counts={counts} />
      <PreferencesForm initial={prefs} roles={ROLE_IDS.map((id) => ({ id, label: ROLES[id].label, hint: ROLES[id].hint }))} />
    </main>
  );
}
