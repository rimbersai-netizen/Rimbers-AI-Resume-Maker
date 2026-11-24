"use server";

import { z } from "zod";
import { createResumeCore, getExportCore, LayoutSchema, requestExportCore, type ActionResult, type ExportState } from "@/lib/services/resumes";
import { createClient } from "@/lib/supabase/server";
import { entitlement, PLAN_NAMES } from "@/lib/entitlements";
import { isPremiumTemplate, type ResumeLayout } from "@/lib/resume-settings";
import { loadPrimaryProfile, type Loaded } from "../profile/actions";

export type { ActionResult, ExportState };

async function ctx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function createResume(input: ResumeLayout): Promise<ActionResult<{ id: string }>> {
  const { supabase, user } = await ctx();
  if (!user) return { ok: false, kind: "auth", message: "Please sign in again." };
  return createResumeCore(supabase, user, input);
}

export interface LoadedResume {
  id: string;
  updatedAt: string;
  layout: ResumeLayout;
  profile: Loaded;
  photoUrl: string | null;
  premiumAllowed: boolean;
}

export async function loadResume(id: string): Promise<LoadedResume | null> {
  const { supabase, user } = await ctx();
  if (!user || !z.string().uuid().safeParse(id).success) return null;
  const { data: doc } = await supabase.from("resume_documents")
    .select("id,title,country_code,locale,template_id,page_size,include_photo,settings,updated_at").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!doc) return null;
  const { data: secs } = await supabase.from("resume_sections").select("section_key,is_visible,custom_heading").eq("resume_id", id).order("sort_order");
  const profile = await loadPrimaryProfile();
  if (!profile) return null;
  const photoPath = profile.profile.personal.photoPath;
  const photoUrl = photoPath ? (await supabase.storage.from("profile-photos").createSignedUrl(photoPath, 3600)).data?.signedUrl ?? null : null;
  const settings = (doc.settings ?? {}) as Partial<ResumeLayout["settings"]>;
  return {
    id: doc.id,
    updatedAt: doc.updated_at,
    profile,
    photoUrl,
    premiumAllowed: (await entitlement(supabase, "premium_template")).allowed,
    layout: {
      title: doc.title, countryCode: doc.country_code, locale: doc.locale, templateId: doc.template_id,
      pageSize: doc.page_size, includePhoto: doc.include_photo,
      settings: { hiddenItemIds: settings.hiddenItemIds ?? [], dateFormat: settings.dateFormat, overridden: settings.overridden ?? [], summaryOverride: settings.summaryOverride },
      sections: (secs ?? []).map((s) => ({ key: s.section_key, visible: s.is_visible, heading: s.custom_heading ?? undefined })),
    },
  };
}

export async function saveLayout(id: string, input: ResumeLayout, expectedUpdatedAt: string | null): Promise<ActionResult<{ updatedAt: string }>> {
  const parsed = LayoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, kind: "invalid", message: parsed.error.issues[0]?.message ?? "Invalid settings" };
  const { supabase, user } = await ctx();
  if (!user) return { ok: false, kind: "auth", message: "Please sign in again." };
  if (isPremiumTemplate(parsed.data.templateId) && !(await entitlement(supabase, "premium_template")).allowed) {
    return { ok: false, kind: "entitlement", upgradeTo: "PROFESSIONAL", message: "That template is part of the Professional plan." };
  }
  const { data, error } = await supabase.rpc("save_resume_layout", { p_id: id, p_layout: parsed.data, p_expected_updated_at: expectedUpdatedAt });
  if (error?.code === "40001") return { ok: false, kind: "conflict", message: "This resume was changed in another tab. Reload to see the latest." };
  if (error) return { ok: false, kind: "error", message: "Could not save. Please try again." };
  return { ok: true, value: { updatedAt: data.updatedAt } };
}

export async function deleteResume(id: string): Promise<ActionResult> {
  const { supabase, user } = await ctx();
  if (!user) return { ok: false, kind: "auth", message: "Please sign in again." };
  const { error, count } = await supabase.from("resume_documents").update({ deleted_at: new Date().toISOString() }, { count: "exact" }).eq("id", id).is("deleted_at", null);
  if (error || !count) return { ok: false, kind: "error", message: "Could not delete the resume." };
  return { ok: true };
}

/** Queue a PDF/DOCX export (quota checked server-side). The document worker renders it. */
export async function requestExport(resumeId: string, format: "pdf" | "docx"): Promise<ActionResult<{ id: string }>> {
  const { supabase, user } = await ctx();
  if (!user) return { ok: false, kind: "auth", message: "Please sign in again." };
  return requestExportCore(supabase, user, resumeId, format);
}

/** Poll an export; when ready, returns a short-lived signed download URL (private bucket). */
export async function getExport(exportId: string): Promise<ExportState | null> {
  const { supabase, user } = await ctx();
  if (!user) return null;
  return getExportCore(supabase, exportId);
}
