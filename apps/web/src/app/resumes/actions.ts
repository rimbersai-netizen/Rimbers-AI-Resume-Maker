"use server";

import { z } from "zod";
import { SECTION_KEYS } from "@gars/resume-schema";
import { SUPPORTED_LOCALES } from "@gars/shared-types";
import { evaluate, type Feature, type SubscriptionRow, type EntitlementRow } from "@gars/subscriptions";
import { getTemplate } from "@gars/template-engine";
import { createClient } from "@/lib/supabase/server";
import { isPremiumTemplate, type ResumeLayout } from "@/lib/resume-settings";
import { loadPrimaryProfile, type Loaded } from "../profile/actions";

const LayoutSchema = z.object({
  title: z.string().trim().min(1).max(200),
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  locale: z.enum(SUPPORTED_LOCALES),
  templateId: z.string().refine((id) => Boolean(getTemplate(id)), "Unknown template"),
  pageSize: z.enum(["A4", "Letter"]),
  includePhoto: z.boolean(),
  settings: z.object({
    hiddenItemIds: z.array(z.string().max(64)).max(500),
    dateFormat: z.string().max(20).optional(),
    overridden: z.array(z.enum(["locale", "pageSize", "includePhoto", "sectionOrder", "templateId", "dateFormat"])),
  }),
  sections: z.array(z.object({ key: z.enum(SECTION_KEYS), visible: z.boolean(), heading: z.string().max(120).optional() })).min(1).max(40),
});

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { value: T }))
  | { ok: false; kind: "invalid" | "auth" | "entitlement" | "conflict" | "error"; message: string; upgradeTo?: string };

async function ctx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Server-side entitlement decision (never trust the client). */
async function entitlement(supabase: Awaited<ReturnType<typeof createClient>>, feature: Feature) {
  const [subs, ents, resumes] = await Promise.all([
    supabase.from("subscriptions").select("plan_id,status,current_period_end,cancel_at_period_end"),
    supabase.from("entitlements").select("feature,source,valid_from,valid_until"),
    supabase.from("resume_documents").select("id", { count: "exact", head: true }).is("deleted_at", null),
  ]);
  return evaluate(feature, {
    subscriptions: (subs.data ?? []) as SubscriptionRow[],
    entitlements: (ents.data ?? []) as EntitlementRow[],
    usage: { resumes: resumes.count ?? 0, ai_requests_month: 0, exports_month: 0 },
    now: new Date(),
  });
}

const PLAN_NAMES: Record<string, string> = { STANDARD: "Standard", PROFESSIONAL: "Professional", PREMIUM: "Premium" };

export async function createResume(input: ResumeLayout): Promise<ActionResult<{ id: string }>> {
  const parsed = LayoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, kind: "invalid", message: parsed.error.issues[0]?.message ?? "Invalid settings" };
  const { supabase, user } = await ctx();
  if (!user) return { ok: false, kind: "auth", message: "Please sign in again." };

  const quota = await entitlement(supabase, "create_resume");
  if (!quota.allowed) {
    return { ok: false, kind: "entitlement", upgradeTo: quota.upgradeTo,
      message: `Your ${quota.plan === "FREE" ? "Free" : quota.plan} plan includes ${quota.plan === "FREE" ? "1 resume" : "a limited number of resumes"}. Upgrade${quota.upgradeTo ? ` to ${PLAN_NAMES[quota.upgradeTo]}` : ""} for more, or edit an existing resume.` };
  }
  const l = parsed.data;
  if (isPremiumTemplate(l.templateId) && !(await entitlement(supabase, "premium_template")).allowed) {
    return { ok: false, kind: "entitlement", upgradeTo: "PROFESSIONAL", message: "That template is part of the Professional plan." };
  }

  const profile = await loadPrimaryProfile();
  if (!profile) return { ok: false, kind: "auth", message: "Please sign in again." };
  const ins = await supabase.from("resume_documents").insert({
    user_id: user.id, master_profile_id: profile.id, title: l.title, country_code: l.countryCode, locale: l.locale,
    template_id: l.templateId, page_size: l.pageSize, include_photo: l.includePhoto, settings: l.settings,
  }).select("id").single();
  if (ins.error || !ins.data) return { ok: false, kind: "error", message: "Could not create the resume. Please try again." };
  const lay = await supabase.rpc("save_resume_layout", { p_id: ins.data.id, p_layout: { sections: l.sections } });
  if (lay.error) {
    // Compensate so a half-created resume never lingers (and never consumes the plan's resume quota).
    await supabase.from("resume_documents").delete().eq("id", ins.data.id);
    return { ok: false, kind: "error", message: "Could not create the resume. Please try again." };
  }
  await supabase.rpc("write_audit_log", { p_action: "resume.created", p_entity_type: "resume", p_entity_id: ins.data.id, p_metadata: { country: l.countryCode, locale: l.locale } });
  return { ok: true, value: { id: ins.data.id } };
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
      settings: { hiddenItemIds: settings.hiddenItemIds ?? [], dateFormat: settings.dateFormat, overridden: settings.overridden ?? [] },
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
