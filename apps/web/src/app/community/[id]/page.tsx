import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPost } from "@/lib/services/community";
import { Thread } from "./thread";

export const dynamic = "force-dynamic";

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?next=/community/${id}`);
  const r = await getPost(supabase, user, id);
  if (!r) notFound();
  return (
    <main className="page jobs-page">
      <Link href="/community" className="muted">← Community</Link>
      <Thread post={r.post} initialComments={r.comments} />
    </main>
  );
}
