import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LetterEditor } from "./letter-editor";

export const metadata = { title: "Cover letter · Global AI Resume Studio" };

export default async function LetterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?next=/cover-letters/${id}`);
  const { data: l } = await supabase.from("cover_letters").select("id,title,body,locale,page_size,job_title,company,resume_id").eq("id", id).maybeSingle();
  if (!l) notFound();
  return <main className="page"><LetterEditor letter={l} /></main>;
}
