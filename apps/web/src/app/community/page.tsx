import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { KINDS, listPosts } from "@/lib/services/community";
import { Feed } from "./feed";

export const metadata = { title: "Community · Rimbers AI Resume Maker" };
export const dynamic = "force-dynamic";

export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/community");
  const posts = await listPosts(supabase, user, { kind });
  const active = (KINDS as readonly string[]).includes(kind ?? "") ? kind : undefined;
  return (
    <main className="page jobs-page">
      <Link href="/dashboard" className="muted">← Dashboard</Link>
      <h1>Community</h1>
      <p className="muted">Share wins, ask questions, and get feedback. You appear under an anonymous name — never your real name or email.</p>
      <nav className="jobs-tabs" aria-label="Filter posts">
        <Link href="/community" aria-current={!active ? "page" : undefined}>All</Link>
        {KINDS.map((k) => <Link key={k} href={`/community?kind=${k}`} aria-current={active === k ? "page" : undefined}>{k === "win" ? "Wins" : k === "question" ? "Questions" : k === "roast" ? "Feedback" : "Discussion"}</Link>)}
      </nav>
      <Feed initial={posts} />
    </main>
  );
}
