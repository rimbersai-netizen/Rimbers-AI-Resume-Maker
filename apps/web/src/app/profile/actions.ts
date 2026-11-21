"use server";

import { createClient } from "@/lib/supabase/server";
import { prepareForSave, toDraft, type Draft, type Issues } from "@/lib/profile-draft";

export interface Loaded {
  id: string;
  updatedAt: string;
  profile: Draft;
}

export type SaveResult =
  | { ok: true; updatedAt: string; version?: number }
  | { ok: false; kind: "invalid"; issues: Issues }
  | { ok: false; kind: "conflict"; serverUpdatedAt?: string }
  | { ok: false; kind: "auth" | "error"; message: string };

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Load the user's primary master profile, creating an empty one on first visit. */
export async function loadPrimaryProfile(): Promise<Loaded | null> {
  const { supabase, user } = await requireUser();
  if (!user) return null;
  let { data: row } = await supabase.from("master_profiles").select("id").eq("is_primary", true).maybeSingle();
  if (!row) {
    const ins = await supabase.from("master_profiles").insert({ user_id: user.id, is_primary: true }).select("id").single();
    // Two tabs racing: the partial unique index rejects the second insert; re-read.
    row = ins.data ?? (await supabase.from("master_profiles").select("id").eq("is_primary", true).single()).data;
  }
  if (!row) throw new Error("Could not create profile");
  const { data, error } = await supabase.rpc("get_master_profile", { p_id: row.id });
  if (error || !data) throw new Error("Could not load profile");
  // A new profile (empty name) is not schema-valid yet; toDraft fills a complete draft shape.
  return { id: data.meta.id, updatedAt: data.meta.updatedAt, profile: toDraft(data.profile) };
}

export async function saveProfile(id: string, draft: unknown, expectedUpdatedAt: string | null, snapshotLabel?: string): Promise<SaveResult> {
  const prepared = prepareForSave(draft);
  if (!prepared.ok) return { ok: false, kind: "invalid", issues: prepared.issues };
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, kind: "auth", message: "Your session expired. Sign in again — your changes are kept on this device." };
  const { data, error } = await supabase.rpc("save_master_profile", {
    p_id: id, p_data: prepared.profile, p_expected_updated_at: expectedUpdatedAt, p_snapshot_label: snapshotLabel ?? null,
  });
  if (error) {
    if (error.code === "40001") return { ok: false, kind: "conflict", serverUpdatedAt: error.details ?? undefined };
    if (error.code === "23514" || error.code === "22P02") return { ok: false, kind: "error", message: "Some values are not valid. Check dates and links." };
    return { ok: false, kind: "error", message: "Could not save right now. Your changes are kept on this device." };
  }
  return { ok: true, updatedAt: data.updatedAt, version: data.version ?? undefined };
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
