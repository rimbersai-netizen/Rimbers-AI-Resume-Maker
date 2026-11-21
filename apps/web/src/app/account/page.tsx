import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Brand } from "../form-bits";
import { DeletionForm } from "./deletion-form";

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/account");
  return (
    <main className="shell">
      <section className="card" aria-labelledby="t" style={{ maxWidth: 560 }}>
        <Brand />
        <h1 id="t">Privacy &amp; data</h1>
        <p className="muted">Signed in as {user.email ?? "guest"}</p>
        <h2>Download your data</h2>
        <p className="muted">A JSON file with your profile, resumes and settings.</p>
        <a className="btn secondary" href="/api/account/export" download>Download my data</a>
        <h2>Delete account</h2>
        <p className="muted">This permanently removes your account, resumes and uploaded files.</p>
        <DeletionForm />
      </section>
    </main>
  );
}
