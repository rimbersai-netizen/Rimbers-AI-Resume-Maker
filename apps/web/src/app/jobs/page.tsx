import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFeed, pipelineCounts } from "@/lib/services/jobs";
import { JobsNav } from "./bits";
import { Discover } from "./discover";

export const metadata = { title: "Jobs · Global AI Resume Studio" };
export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/jobs");
  const counts = await pipelineCounts(supabase);
  let feed;
  try { feed = await getFeed(supabase, user, { limit: 20 }); } catch { feed = null; }
  if (feed && !feed.prefsSaved) redirect("/jobs/preferences");
  return (
    <main className="page jobs-page">
      <Link href="/dashboard" className="muted">← Dashboard</Link>
      <h1>Jobs</h1>
      <JobsNav active="discover" counts={counts} />
      {!feed ? <p className="alert error" role="alert">Job listings are unavailable right now. Please try again in a few minutes.</p> : (
        <>
          {!feed.profileReady && <p className="alert ok">Complete your <Link href="/profile">profile</Link> so match scores reflect your real skills and experience.</p>}
          {feed.degraded.length > 0 && <p className="muted small">Some sources are temporarily unavailable ({feed.degraded.join(", ")}).</p>}
          <Discover initial={feed.jobs} total={feed.total} />
        </>
      )}
      <p className="muted small jobs-credit">Listings come from public job boards (Remotive, Arbeitnow). Match scores are estimates based on your profile — not a prediction of an employer’s decision. You always apply on the employer’s own page.</p>
    </main>
  );
}
