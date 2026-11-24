import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadPrimaryProfile } from "./actions";
import { ProfileBuilder } from "./builder";

export const metadata = { title: "Your profile · Rimbers AI Resume Maker" };

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/profile");
  const loaded = await loadPrimaryProfile();
  if (!loaded) redirect("/sign-in?next=/profile");
  return <main className="page"><ProfileBuilder initial={loaded} userId={user.id} /></main>;
}
