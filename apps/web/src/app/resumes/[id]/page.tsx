import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadResume } from "../actions";
import { ResumeEditor } from "./editor";

export const metadata = { title: "Edit resume · Global AI Resume Studio" };

export default async function ResumePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?next=/resumes/${id}`);
  const [loaded, { data: prefs }] = await Promise.all([loadResume(id), supabase.from("profiles").select("app_locale").eq("id", user.id).maybeSingle()]);
  if (!loaded) notFound();
  return <main className="editor-page"><ResumeEditor initial={loaded} appLocale={prefs?.app_locale ?? "en"} /></main>;
}
