"use server";

import { createClient } from "@/lib/supabase/server";
import { toDraft, type Draft } from "@/lib/profile-draft";
import { loadPrimaryProfileCore, saveProfileCore, type Loaded, type SaveResult } from "@/lib/services/profile";

export type { Loaded, SaveResult };

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Load the user's primary master profile, creating an empty one on first visit. */
export async function loadPrimaryProfile(): Promise<Loaded | null> {
  const { supabase, user } = await requireUser();
  if (!user) return null;
  return loadPrimaryProfileCore(supabase, user);
}

export async function saveProfile(id: string, draft: unknown, expectedUpdatedAt: string | null, snapshotLabel?: string): Promise<SaveResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, kind: "auth", message: "Your session expired. Sign in again — your changes are kept on this device." };
  return saveProfileCore(supabase, id, draft, expectedUpdatedAt, snapshotLabel);
}

export async function listVersions(id: string) {
  const { supabase, user } = await requireUser();
  if (!user) return [];
  const { data } = await supabase.from("master_profile_versions").select("id, version_no, label, created_at")
    .eq("master_profile_id", id).order("version_no", { ascending: false }).limit(50);
  return data ?? [];
}

export async function getVersionSnapshot(versionId: string): Promise<Draft | null> {
  const { supabase, user } = await requireUser();
  if (!user) return null;
  const { data } = await supabase.from("master_profile_versions").select("snapshot").eq("id", versionId).maybeSingle();
  return data?.snapshot ? toDraft(data.snapshot) : null;
}
