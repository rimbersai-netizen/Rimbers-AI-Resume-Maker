/**
 * Export job processing (service role). Loads the resume + master profile, renders the SAME HTML as the preview,
 * converts to PDF, uploads to the private bucket under the owner's folder, and records the result.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { MasterProfile, type ResumeDocument } from "@gars/resume-schema";
import { toResumeDocument, type ResumeLayout } from "@gars/resume-builder";
import { getTemplate, letterDate, renderCoverLetterHtml, renderResumeHtml, TEMPLATES, type LetterInput, type TemplateSpec } from "@gars/template-engine";
import { buildCoverLetterDocx, buildDocx } from "./docx";
import { renderPdf } from "./pdf";

export interface ExportRow {
  id: string;
  user_id: string;
  resume_id: string | null;
  cover_letter_id?: string | null;
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
    settings: { hiddenItemIds: s.hiddenItemIds ?? [], overridden: s.overridden ?? [], dateFormat: s.dateFormat, summaryOverride: s.summaryOverride },
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

/** Cover letter export inputs (service role; scoped to the job's user). Accent follows the linked resume's template. */
export async function loadLetterInputs(db: SupabaseClient, letterId: string, userId: string): Promise<LetterInput> {
  const { data: cl } = await db.from("cover_letters").select("id,user_id,body,locale,page_size,resume_id,created_at").eq("id", letterId).eq("user_id", userId).maybeSingle();
  if (!cl) throw new Error("cover letter not found");
  const { data: mp } = await db.from("master_profiles").select("id").eq("user_id", userId).eq("is_primary", true).maybeSingle();
  const { data: prof } = mp ? await db.rpc("get_master_profile", { p_id: mp.id }) : { data: null };
  const pd = (prof?.profile?.personal ?? {}) as { fullName?: string; professionalTitle?: string; email?: string; phone?: string; location?: { city?: string } };
  let spec: TemplateSpec | undefined;
  let country: string | undefined;
  if (cl.resume_id) {
    const { data: r } = await db.from("resume_documents").select("template_id,country_code").eq("id", cl.resume_id).eq("user_id", userId).maybeSingle();
    spec = r ? getTemplate(r.template_id) : undefined;
    country = r?.country_code;
  }
  return {
    body: cl.body, locale: cl.locale, pageSize: cl.page_size, dateText: letterDate(cl.locale, new Date(), country),
    sender: { fullName: pd.fullName || "—", professionalTitle: pd.professionalTitle, email: pd.email, phone: pd.phone, city: pd.location?.city },
    accent: spec?.accent, fontStyle: spec?.typography.fontStack,
  };
}

export async function processExport(db: SupabaseClient, job: ExportRow): Promise<{ ok: boolean; path?: string; error?: string }> {
  try {
    let out: { bytes: Buffer; contentType: string; ext: string };
    let subject: string;
    if (job.cover_letter_id) {
      const l = await loadLetterInputs(db, job.cover_letter_id, job.user_id);
      out = job.format === "docx"
        ? { bytes: await buildCoverLetterDocx(l), contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: "docx" }
        : { bytes: await renderPdf(renderCoverLetterHtml(l), { pageSize: l.pageSize }), contentType: "application/pdf", ext: "pdf" };
      subject = `letters/${job.cover_letter_id}`;
    } else {
      out = await renderExport(await loadResumeInputs(db, job.resume_id!, job.user_id), job.format);
      subject = job.resume_id!;
    }
    const path = `${job.user_id}/${subject}/${job.id}.${out.ext}`;
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
