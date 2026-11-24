import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listPipeline, pipelineCounts } from "@/lib/services/jobs";
import { JobsNav } from "../bits";
import { PipelineList } from "../pipeline-list";

export const metadata = { title: "Saved jobs · Global AI Resume Studio" };
export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/jobs/saved");
  const [items, counts] = await Promise.all([listPipeline(supabase, ["saved"]), pipelineCounts(supabase)]);
  return (
    <main className="page jobs-page">
      <Link href="/dashboard" className="muted">← Dashboard</Link>
      <h1>Saved jobs</h1>
      <JobsNav active="saved" counts={counts} />
      <PipelineList initial={items} mode="saved" />
    </main>
  );
}
