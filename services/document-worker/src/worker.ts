/**
 * Export job processing (service role). Loads the resume + master profile, renders the SAME HTML as the preview,
 * converts to PDF, uploads to the private bucket under the owner's folder, and records the result.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { MasterProfile } from "@gars/resume-schema";
import { toResumeDocument, type ResumeLayout } from "@gars/resume-builder";
import { getTemplate, renderResumeHtml, TEMPLATES } from "@gars/template-engine";
import { renderPdf } from "./pdf";

export interface ExportRow {
  id: string;
  user_id: string;
  resume_id: string;
  format: "pdf" | "docx";
  attempts: number;
}

export async function buildResumeHtml(db: SupabaseClient, resumeId: string, userId: string): Promise<{ html: string; pageSize: "A4" | "Letter"; title: string }> {
  const { data: doc, error } = await db.from("resume_documents")
    .select("id,user_id,master_profile_id,title,country_code,locale,template_id,page_size,include_photo,settings")
    .eq("id", resumeId).eq("user_id", userId).is("deleted_at", null).single();
  if (error || !doc) throw new Error("resume not found");
  const { data: secs } = await db.from("resume_sections").select("section_key,is_visible,custom_heading").eq("resume_id", resumeId).order("sort_order");
  const { data: prof } = await db.rpc("get_master_profile", { p_id: doc.master_profile_id });
  const parsed = MasterProfile.safeParse(prof?.profile);
  if (!parsed.success) throw new Error("profile incomplete");
  const s = (doc.settings ?? {}) as Partial<ResumeLayout["settings"]>;
  const layout: ResumeLayout = {
    title: doc.title, countryCode: doc.country_code, locale: doc.locale, templateId: doc.template_id, pageSize: doc.page_size,
    includePhoto: doc.include_photo,
    settings: { hiddenItemIds: s.hiddenItemIds ?? [], overridden: s.overridden ?? [], dateFormat: s.dateFormat },
    sections: (secs ?? []).map((x) => ({ key: x.section_key, visible: x.is_visible, heading: x.custom_heading ?? undefined })),
  };
  // Photo is embedded as a data: URI (the renderer blocks all network fetches).
  let photoSrc: string | undefined;
  const photoPath = parsed.data.personal.photoPath;
  if (layout.includePhoto && photoPath?.startsWith(`${userId}/`)) {
    const { data: blob } = await db.storage.from("profile-photos").download(photoPath);
    if (blob && blob.size <= 5 * 1024 * 1024) photoSrc = `data:${blob.type || "image/jpeg"};base64,${Buffer.from(await blob.arrayBuffer()).toString("base64")}`;
  }
  const template = getTemplate(layout.templateId) ?? TEMPLATES[0]!;
  return { html: renderResumeHtml(toResumeDocument(doc.id, layout, parsed.data), template, { photoSrc }), pageSize: layout.pageSize, title: layout.title };
}

export async function processExport(db: SupabaseClient, job: ExportRow): Promise<{ ok: boolean; path?: string; error?: string }> {
  try {
    if (job.format !== "pdf") throw new Error("format not supported yet");
    const { html, pageSize, title } = await buildResumeHtml(db, job.resume_id, job.user_id);
    const pdf = await renderPdf(html, { pageSize, title });
    const path = `${job.user_id}/${job.resume_id}/${job.id}.pdf`;
    const up = await db.storage.from("resume-exports").upload(path, pdf, { contentType: "application/pdf", upsert: true });
    if (up.error) throw new Error(`upload failed: ${up.error.message}`);
    await db.from("document_exports").update({ status: "succeeded", storage_path: path, completed_at: new Date().toISOString(), error: null }).eq("id", job.id);
    return { ok: true, path };
  } catch (e) {
    const msg = (e as Error).message.slice(0, 300);
    // Retry up to 3 attempts (claim function stops at 3); final failure is visible to the user.
    const final = job.attempts >= 3 || /not found|incomplete|not supported/.test(msg);
    await db.from("document_exports").update({ status: final ? "failed" : "queued", error: msg, locked_at: null }).eq("id", job.id);
    return { ok: false, error: msg };
  }
}

export async function runOnce(db: SupabaseClient): Promise<boolean> {
  const { data, error } = await db.rpc("claim_document_export", { p_lock_seconds: 120 });
  if (error) throw new Error(`claim failed: ${error.message}`);
  const job = (data as ExportRow[] | null)?.[0];
  if (!job) return false;
  await processExport(db, job);
  return true;
}
