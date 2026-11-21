import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadPrimaryProfile } from "../../profile/actions";
import { NewLetter } from "./new-letter";

export const metadata = { title: "New cover letter · Global AI Resume Studio" };

export default async function NewCoverLetterPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/cover-letters/new");
  const [profile, { data: resumes }, { data: prefs }] = await Promise.all([
    loadPrimaryProfile(),
    supabase.from("resume_documents").select("id,title,locale,page_size").is("deleted_at", null).order("updated_at", { ascending: false }).limit(20),
    supabase.from("profiles").select("app_locale").eq("id", user.id).maybeSingle(),
  ]);
  if (!profile) redirect("/sign-in");
  return <main className="page"><NewLetter masterProfileId={profile.id} profileReady={Boolean(profile.profile.personal.fullName)} resumes={resumes ?? []} appLocale={prefs?.app_locale ?? "en"} /></main>;
}
