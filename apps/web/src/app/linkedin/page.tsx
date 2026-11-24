import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadPrimaryProfile } from "../profile/actions";
import { LinkedInAssistant } from "./assistant";

export const metadata = { title: "LinkedIn assistant · Rimbers AI Resume Maker" };

export default async function LinkedInPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/linkedin");
  const profile = await loadPrimaryProfile();
  if (!profile) redirect("/sign-in");
  const { data: mp } = await supabase.from("master_profiles").select("linkedin").eq("id", profile.id).single();
  const { data: prefs } = await supabase.from("profiles").select("app_locale").eq("id", user.id).maybeSingle();
  const p = profile.profile;
  return (
    <main className="page">
      <LinkedInAssistant
        masterProfileId={profile.id}
        locale={prefs?.app_locale ?? "en"}
        saved={(mp?.linkedin ?? {}) as { headline?: string; about?: string }}
        person={{ name: p.personal.fullName, title: p.personal.professionalTitle, city: p.personal.location.city, linkedin: p.personal.linkedin,
          current: p.experience.find((w) => w.dates.current) ? `${p.experience.find((w) => w.dates.current)!.title} at ${p.experience.find((w) => w.dates.current)!.employer}` : undefined }}
        skills={p.skills.map((s) => s.name)}
        profileReady={Boolean(p.personal.fullName && p.experience.length)}
      />
    </main>
  );
}
