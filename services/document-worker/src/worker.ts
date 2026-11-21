/**
 * Export job processing (service role). Loads the resume + master profile, renders the SAME HTML as the preview,
 * converts to PDF, uploads to the private bucket under the owner's folder, and records the result.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { MasterProfile, type ResumeDocument } from "@gars/resume-schema";
import { toResumeDocument, type ResumeLayout } from "@gars/resume-builder";
import { getTemplate, renderResumeHtml, TEMPLATES, type TemplateSpec } from "@gars/template-engine";
import { buildDocx } from "./docx";
import { renderPdf } from "./pdf";

export interface ExportRow {
  id: string;
  user_id: string;
  resume_id: string;
  format: "pdf" | "docx";
  attempts: number;
}

export interface ResumeInputs {
  doc: ResumeDocument;
  template: TemplateSpec;
  photo?: { data: Buffer; mime: string };
}

/** Load everything an export needs (service role; scoped to the job's user). */
export async function loadResumeInputs(db: SupabaseClient, resumeId: string, userId: string): Promise<ResumeInputs> {
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
  let photo: ResumeInputs["photo"];
  const photoPath = parsed.data.personal.photoPath;
  if (layout.includePhoto && photoPath?.startsWith(`${userId}/`)) {
    const { data: blob } = await db.storage.from("profile-photos").download(photoPath);
    if (blob && blob.size <= 5 * 1024 * 1024) photo = { data: Buffer.from(await blob.arrayBuffer()), mime: blob.type || "image/jpeg" };
  }
  return { doc: toResumeDocument(doc.id, layout, parsed.data), template: getTemplate(layout.templateId) ?? TEMPLATES[0]!, photo };
}

export async function renderExport(inputs: ResumeInputs, format: "pdf" | "docx"): Promise<{ bytes: Buffer; contentType: string; ext: string }> {
  if (format === "docx") {
    const type = inputs.photo?.mime === "image/png" ? "png" : "jpg";
    const bytes = await buildDocx(inputs.doc, inputs.template, {
      includePhoto: inputs.doc.includePhoto,
      photo: inputs.photo && inputs.photo.mime !== "image/webp" ? { data: inputs.photo.data, type } : undefined, // Word lacks WebP support
    });
    return { bytes, contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: "docx" };
  }
  // Photo as data: URI — the PDF renderer blocks all network fetches.
  const photoSrc = inputs.photo ? `data:${inputs.photo.mime};base64,${inputs.photo.data.toString("base64")}` : undefined;
  const bytes = await renderPdf(renderResumeHtml(inputs.doc, inputs.template, { photoSrc }), { pageSize: inputs.doc.pageSize, title: inputs.doc.title });
  return { bytes, contentType: "application/pdf", ext: "pdf" };
}

export async function processExport(db: SupabaseClient, job: ExportRow): Promise<{ ok: boolean; path?: string; error?: string }> {
  try {
    const out = await renderExport(await loadResumeInputs(db, job.resume_id, job.user_id), job.format);
    const path = `${job.user_id}/${job.resume_id}/${job.id}.${out.ext}`;
    const up = await db.storage.from("resume-exports").upload(path, out.bytes, { contentType: out.contentType, upsert: true });
    if (up.error) throw new Error(`upload failed: ${up.error.message}`);
    await db.from("document_exports").update({ status: "succeeded", storage_path: path, completed_at: new Date().toISOString(), error: null }).eq("id", job.id);
    return { ok: true, path };
  } catch (e) {
    const msg = (e as Error).message.slice(0, 300);
    // Retry up to 3 attempts (claim function stops at 3); final failure is visible to the user.
    const final = job.attempts >= 3 || /not found|incomplete/.test(msg);
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
