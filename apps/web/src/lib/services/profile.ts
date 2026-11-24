import type { SupabaseClient, User } from "@supabase/supabase-js";
import { prepareForSave, toDraft, type Draft, type Issues } from "../profile-draft";

export interface Loaded { id: string; updatedAt: string; profile: Draft }

export type SaveResult =
  | { ok: true; updatedAt: string; version?: number }
  | { ok: false; kind: "invalid"; issues: Issues }
  | { ok: false; kind: "conflict"; serverUpdatedAt?: string }
  | { ok: false; kind: "auth" | "error"; message: string };

/** Load the user's primary master profile, creating an empty one on first use. */
export async function loadPrimaryProfileCore(supabase: SupabaseClient, user: User): Promise<Loaded | null> {
  let { data: row } = await supabase.from("master_profiles").select("id").eq("is_primary", true).maybeSingle();
  if (!row) {
    const ins = await supabase.from("master_profiles").insert({ user_id: user.id, is_primary: true }).select("id").single();
    // Two clients racing: the partial unique index rejects the second insert; re-read.
    row = ins.data ?? (await supabase.from("master_profiles").select("id").eq("is_primary", true).single()).data;
  }
  if (!row) throw new Error("Could not create profile");
  const { data, error } = await supabase.rpc("get_master_profile", { p_id: row.id });
  if (error || !data) throw new Error("Could not load profile");
  return { id: data.meta.id, updatedAt: data.meta.updatedAt, profile: toDraft(data.profile) };
}

/** Validate through the shared Zod contract, then save atomically with optimistic concurrency. */
export async function saveProfileCore(supabase: SupabaseClient, id: string, draft: unknown, expectedUpdatedAt: string | null, snapshotLabel?: string): Promise<SaveResult> {
  const prepared = prepareForSave(draft);
  if (!prepared.ok) return { ok: false, kind: "invalid", issues: prepared.issues };
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
