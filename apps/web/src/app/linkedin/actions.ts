"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const Draft = z.object({ headline: z.string().trim().max(220).optional(), about: z.string().trim().max(2600).optional() });

/** Save LinkedIn drafts on the user's primary master profile (RLS: owner update only). */
export async function saveLinkedInDraft(masterProfileId: string, draft: z.infer<typeof Draft>): Promise<{ ok: boolean; message?: string }> {
  const p = Draft.safeParse(draft);
  if (!p.success || !z.string().uuid().safeParse(masterProfileId).success) return { ok: false, message: "Too long for LinkedIn (headline 220, About 2,600 characters)." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const { error, count } = await supabase.from("master_profiles")
    .update({ linkedin: { ...p.data, updatedAt: new Date().toISOString() } }, { count: "exact" }).eq("id", masterProfileId);
  return error || !count ? { ok: false, message: "Could not save." } : { ok: true };
}
