import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadPrimaryProfile } from "../../profile/actions";
import { NewResumeWizard } from "./wizard";

export const metadata = { title: "New resume · Rimbers AI Resume Maker" };

export default async function NewResumePage({ searchParams }: { searchParams: Promise<{ template?: string }> }) {
  const { template } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/resumes/new");
  const [profile, { data: prefs }] = await Promise.all([
    loadPrimaryProfile(),
    supabase.from("profiles").select("app_locale,country_code").eq("id", user.id).maybeSingle(),
  ]);
  return (
    <main className="page">
      <NewResumeWizard
        initialTemplate={template ?? null}
        appLocale={prefs?.app_locale ?? "en"}
        initialCountry={prefs?.country_code ?? profile?.profile.personal.location.country ?? null}
        hasPhoto={Boolean(profile?.profile.personal.photoPath)}
        profileReady={Boolean(profile?.profile.personal.fullName)}
      />
    </main>
  );
}
