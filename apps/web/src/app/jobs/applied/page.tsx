import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listPipeline, pipelineCounts } from "@/lib/services/jobs";
import { JobsNav } from "../bits";
import { PipelineList } from "../pipeline-list";

export const metadata = { title: "Applications · Rimbers AI Resume Maker" };
export const dynamic = "force-dynamic";

export default async function AppliedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/jobs/applied");
  const [items, counts] = await Promise.all([
    listPipeline(supabase, ["ready", "applying", "needs_you", "applied", "interview", "offer", "rejected"]),
    pipelineCounts(supabase),
  ]);
  const thisMonth = items.filter((i) => i.appliedAt && new Date(i.appliedAt).getMonth() === new Date().getMonth()).length;
  return (
    <main className="page jobs-page">
      <Link href="/dashboard" className="muted">← Dashboard</Link>
      <h1>Applications</h1>
      <JobsNav active="applied" counts={counts} />
      <p className="muted"><strong>{thisMonth}</strong> applied this month · you submit each application yourself on the employer’s page, then update its status here.</p>
      <PipelineList initial={items} mode="applications" />
    </main>
  );
}
