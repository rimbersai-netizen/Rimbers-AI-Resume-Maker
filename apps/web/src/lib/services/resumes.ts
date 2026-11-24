import type { SupabaseClient, User } from "@supabase/supabase-js";
import { z } from "zod";
import { SECTION_KEYS } from "@gars/resume-schema";
import { SUPPORTED_LOCALES } from "@gars/shared-types";
import { getTemplate } from "@gars/template-engine";
import { entitlement, PLAN_NAMES } from "../entitlements";
import { isPremiumTemplate, type ResumeLayout } from "../resume-settings";

export const LayoutSchema = z.object({
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
    summaryOverride: z.string().trim().max(1200).optional(),
  }),
  sections: z.array(z.object({ key: z.enum(SECTION_KEYS), visible: z.boolean(), heading: z.string().max(120).optional() })).min(1).max(40),
});

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { value: T }))
  | { ok: false; kind: "invalid" | "auth" | "entitlement" | "conflict" | "error"; message: string; upgradeTo?: string };

/** Primary master profile id, creating an empty profile on first use (same behaviour as the web profile loader). */
async function primaryProfileId(supabase: SupabaseClient, user: User): Promise<string | null> {
  let { data: row } = await supabase.from("master_profiles").select("id").eq("is_primary", true).maybeSingle();
  if (!row) {
    const ins = await supabase.from("master_profiles").insert({ user_id: user.id, is_primary: true }).select("id").single();
    row = ins.data ?? (await supabase.from("master_profiles").select("id").eq("is_primary", true).single()).data;
  }
  return row?.id ?? null;
}

/** Create a resume after the server-side plan checks. Shared by web server actions and the mobile API. */
export async function createResumeCore(supabase: SupabaseClient, user: User, input: ResumeLayout): Promise<ActionResult<{ id: string }>> {
  const parsed = LayoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, kind: "invalid", message: parsed.error.issues[0]?.message ?? "Invalid settings" };
  const quota = await entitlement(supabase, "create_resume");
  if (!quota.allowed) {
    return { ok: false, kind: "entitlement", upgradeTo: quota.upgradeTo,
      message: `Your ${quota.plan === "FREE" ? "Free" : quota.plan} plan includes ${quota.plan === "FREE" ? "1 resume" : "a limited number of resumes"}. Upgrade${quota.upgradeTo ? ` to ${PLAN_NAMES[quota.upgradeTo]}` : ""} for more, or edit an existing resume.` };
  }
  const l = parsed.data;
  if (isPremiumTemplate(l.templateId) && !(await entitlement(supabase, "premium_template")).allowed) {
    return { ok: false, kind: "entitlement", upgradeTo: "PROFESSIONAL", message: "That template is part of the Professional plan." };
  }
  const profileId = await primaryProfileId(supabase, user);
  if (!profileId) return { ok: false, kind: "error", message: "Could not load your profile." };
  const ins = await supabase.from("resume_documents").insert({
    user_id: user.id, master_profile_id: profileId, title: l.title, country_code: l.countryCode, locale: l.locale,
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

export interface ExportState { id: string; status: "queued" | "running" | "succeeded" | "failed"; url?: string; error?: string; format?: "pdf" | "docx" }

export async function requestExportCore(supabase: SupabaseClient, user: User, resumeId: string, format: "pdf" | "docx"): Promise<ActionResult<{ id: string }>> {
  if (!z.string().uuid().safeParse(resumeId).success || (format !== "pdf" && format !== "docx")) return { ok: false, kind: "invalid", message: "Unknown resume" };
  const quota = await entitlement(supabase, format === "docx" ? "export_docx" : "export_pdf");
  if (!quota.allowed) {
    return { ok: false, kind: "entitlement", upgradeTo: quota.upgradeTo,
      message: quota.reason === "plan_feature"
        ? `Editable Word (DOCX) downloads are included from the ${quota.upgradeTo ? PLAN_NAMES[quota.upgradeTo] : "Standard"} plan.`
        : `You have used this month's downloads on the ${quota.plan === "FREE" ? "Free" : quota.plan} plan. Upgrade${quota.upgradeTo ? ` to ${PLAN_NAMES[quota.upgradeTo]}` : ""} for more.` };
  }
  const ins = await supabase.from("document_exports").insert({ user_id: user.id, resume_id: resumeId, format }).select("id").single();
  if (ins.error || !ins.data) return { ok: false, kind: "error", message: "Could not start the export." };
  return { ok: true, value: { id: ins.data.id } };
}

/** Poll an export; when ready, returns a short-lived signed download URL (private bucket). */
export async function getExportCore(supabase: SupabaseClient, exportId: string): Promise<ExportState | null> {
  if (!z.string().uuid().safeParse(exportId).success) return null;
  const { data } = await supabase.from("document_exports").select("id,status,storage_path,error,resume_id,format").eq("id", exportId).maybeSingle();
  if (!data) return null;
  if (data.status !== "succeeded" || !data.storage_path) {
    return { id: data.id, status: data.status, error: data.status === "failed" ? "The export failed. Please try again." : undefined };
  }
  const { data: doc } = await supabase.from("resume_documents").select("title").eq("id", data.resume_id).maybeSingle();
  const name = `${(doc?.title ?? "resume").replace(/[^\p{L}\p{N} _-]+/gu, "").trim().slice(0, 80) || "resume"}.${data.format}`;
  const { data: signed } = await supabase.storage.from("resume-exports").createSignedUrl(data.storage_path, 300, { download: name });
  return { id: data.id, status: "succeeded", url: signed?.signedUrl, format: data.format };
}
