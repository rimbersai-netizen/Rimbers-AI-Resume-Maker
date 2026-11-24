import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../auth-actions";
import { Submit } from "../form-bits";

export const metadata = { title: "Home · Rimbers AI Resume Maker" };
export const dynamic = "force-dynamic";

const TOOLS = [
  ["📊", "ATS Analyzer", "/resumes", "Open a resume → ATS"],
  ["✉️", "Cover Letter", "/cover-letters", null],
  ["💬", "Interview Prep", null, "Soon"],
  ["💼", "Job Search", "/jobs", null],
  ["✨", "LinkedIn", "/linkedin", null],
  ["👥", "Community", "/community", null],
] as const;

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/dashboard");
  const [{ data: resumes }, { data: profile }] = await Promise.all([
    supabase.from("resume_documents").select("id,title,country_code,locale,updated_at").is("deleted_at", null).order("updated_at", { ascending: false }).limit(20),
    supabase.from("master_profiles").select("id").eq("is_primary", true).maybeSingle(),
  ]);
  const name = user.email?.split("@")[0];
  return (
    <main className="home">
      <h1>{user.is_anonymous ? "Hello 👋" : `Hello, ${name} 👋`}</h1>
      <p className="muted">Let’s create your perfect resume</p>
      {user.is_anonymous && (
        <div className="alert ok" role="status">You’re using a guest account. <Link href="/sign-up">Create an account</Link> to keep your resumes.</div>
      )}
      {!profile && <div className="alert ok" role="status">Start by completing your <Link href="/profile">profile</Link> — you enter it once and reuse it for every resume.</div>}

      <Link href="/resumes/new" className="ai-banner">
        <div>
          <span aria-hidden>✦</span>
          <h2>Create Resume with AI</h2>
          <p>Generate, optimize and tailor your resume with the power of AI — using only facts from your profile.</p>
        </div>
        <span className="bot" aria-hidden>🤖</span>
      </Link>

      <div className="tools-grid" role="list" aria-label="Quick tools">
        {TOOLS.map(([icon, label, href, note]) => href ? (
          <Link key={label} href={href} className="tool" role="listitem"><span className="ico" aria-hidden>{icon}</span>{label}{note && <small>{note}</small>}</Link>
        ) : (
          <span key={label} className="tool soon" role="listitem" aria-disabled="true"><span className="ico" aria-hidden>{icon}</span>{label}<small>{note}</small></span>
        ))}
      </div>

      <div className="section-head"><h2>Your Resumes ({resumes?.length ?? 0})</h2><Link href="/resumes/new">+ Create new resume</Link></div>
      {resumes?.length ? resumes.map((r) => (
        <Link key={r.id} href={`/resumes/${r.id}`} className="resume-card">
          <svg className="thumb-mini" viewBox="0 0 44 58" aria-hidden><rect width="44" height="58" rx="5" fill="#fff" stroke="var(--border)" /><circle cx="11" cy="12" r="5" fill="var(--bg-subtle)" /><rect x="20" y="9" width="18" height="4" rx="2" fill="var(--brand-500)" />{[22, 29, 36, 43].map((y) => <rect key={y} x="7" y={y} width={y % 2 ? 30 : 24} height="3" rx="1.5" fill="#D5DCEB" />)}</svg>
          <div><strong>{r.title}</strong><div className="muted small">{r.country_code} · {r.locale} · Updated {new Date(r.updated_at).toLocaleDateString()}</div></div>
        </Link>
      )) : <p className="empty">No resumes yet. Pick a <Link href="/templates">template</Link> or create one with AI.</p>}

      <div className="row" style={{ marginTop: 24 }}>
        <Link href="/profile">Edit my profile</Link><Link href="/pricing">Plans</Link><Link href="/account">Account settings</Link>
        <form action={signOut}><Submit variant="secondary">Sign out</Submit></form>
      </div>
    </main>
  );
}
