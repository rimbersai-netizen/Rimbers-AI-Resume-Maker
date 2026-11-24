import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../auth-actions";
import { Brand, Submit } from "../form-bits";

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/dashboard");
  const { data: resumes } = await supabase.from("resume_documents").select("id,title,country_code,locale,updated_at")
    .is("deleted_at", null).order("updated_at", { ascending: false }).limit(20);
  return (
    <main className="shell">
      <section className="card" aria-labelledby="t" style={{ maxWidth: 720 }}>
        <Brand />
        <h1 id="t">{user.is_anonymous ? "Hi there 👋" : `Hi, ${user.email?.split("@")[0]}`}</h1>
        {user.is_anonymous && (
          <div className="alert ok" role="status">You’re using a guest account. <Link href="/sign-up">Create an account</Link> to keep your resumes.</div>
        )}
        <h2>My resumes ({resumes?.length ?? 0})</h2>
        {resumes?.length ? (
          <ul className="resume-list">{resumes.map((r) => <li key={r.id}><Link href={`/resumes/${r.id}`}><strong>{r.title}</strong></Link> <span className="muted">· {r.country_code} · {r.locale}</span></li>)}</ul>
        ) : <p className="muted">No resumes yet. Start by completing your profile — you enter it once and reuse it for every resume.</p>}
        <Link className="btn" href="/resumes/new">+ Create new resume</Link>
        <div className="row"><Link href="/profile">Edit my profile</Link><Link href="/jobs">Jobs</Link><Link href="/community">Community</Link><Link href="/cover-letters">Cover letters</Link><Link href="/linkedin">LinkedIn</Link><Link href="/account">Account settings</Link></div>
        <form action={signOut}><Submit variant="secondary">Sign out</Submit></form>
      </section>
    </main>
  );
}
