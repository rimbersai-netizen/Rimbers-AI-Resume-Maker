import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Cover letters · Global AI Resume Studio" };

export default async function CoverLettersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/cover-letters");
  const { data: letters } = await supabase.from("cover_letters").select("id,title,company,locale,updated_at").order("updated_at", { ascending: false }).limit(50);
  return (
    <main className="page">
      <Link href="/dashboard" className="muted">← Dashboard</Link>
      <h1>Cover letters</h1>
      <Link className="btn" href="/cover-letters/new" style={{ maxWidth: 320 }}>+ New cover letter</Link>
      {letters?.length ? (
        <ul className="resume-list card wide" style={{ marginTop: 16 }}>
          {letters.map((l) => (
            <li key={l.id}><Link href={`/cover-letters/${l.id}`}><strong>{l.title}</strong></Link> <span className="muted">· {l.company ?? "—"} · {l.locale} · {new Date(l.updated_at).toLocaleDateString()}</span></li>
          ))}
        </ul>
      ) : <p className="empty" style={{ marginTop: 16 }}>No cover letters yet. The AI can draft one from your profile in about a minute.</p>}
    </main>
  );
}
