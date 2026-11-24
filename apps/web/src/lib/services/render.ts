import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getTemplate, renderResumeHtml, TEMPLATES, type TemplateSpec } from "@gars/template-engine";
import type { ResumeDocument } from "@gars/resume-schema";
import { toDraft } from "../profile-draft";
import { toResumeDocument, type ResumeLayout } from "../resume-settings";

export interface RenderInputs { layout: ResumeLayout; doc: ResumeDocument; template: TemplateSpec; photoUrl: string | null }

/** Load a resume (RLS: caller's own) and build the shared ResumeDocument, exactly as the web editor does. */
export async function loadRenderInputs(supabase: SupabaseClient, id: string): Promise<RenderInputs | null> {
  if (!z.string().uuid().safeParse(id).success) return null;
  const { data: row } = await supabase.from("resume_documents")
    .select("id,title,country_code,locale,template_id,page_size,include_photo,settings,master_profile_id").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!row) return null;
  const { data: secs } = await supabase.from("resume_sections").select("section_key,is_visible,custom_heading").eq("resume_id", id).order("sort_order");
  const { data: mp } = await supabase.rpc("get_master_profile", { p_id: row.master_profile_id });
  if (!mp) return null;
  const profile = toDraft(mp.profile);
  const photoPath = profile.personal.photoPath;
  const photoUrl = photoPath ? (await supabase.storage.from("profile-photos").createSignedUrl(photoPath, 3600)).data?.signedUrl ?? null : null;
  const s = (row.settings ?? {}) as Partial<ResumeLayout["settings"]>;
  const layout: ResumeLayout = {
    title: row.title, countryCode: row.country_code, locale: row.locale, templateId: row.template_id, pageSize: row.page_size, includePhoto: row.include_photo,
    settings: { hiddenItemIds: s.hiddenItemIds ?? [], dateFormat: s.dateFormat, overridden: s.overridden ?? [], summaryOverride: s.summaryOverride },
    sections: (secs ?? []).map((x) => ({ key: x.section_key, visible: x.is_visible, heading: x.custom_heading ?? undefined })),
  };
  return { layout, doc: toResumeDocument(id, layout, profile), template: getTemplate(layout.templateId) ?? TEMPLATES[0]!, photoUrl };
}

/** Standalone preview page for in-app WebViews. `origin` is where /fonts/fonts.css is served. */
export function previewHtml(r: RenderInputs, origin: string): string {
  try {
    return renderResumeHtml(r.doc, r.template, { photoSrc: r.photoUrl ?? undefined })
      .replace("<head>", `<head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="${origin}/fonts/fonts.css">`);
  } catch {
    return "<p style='font-family:sans-serif;padding:24px'>Preview unavailable — complete your profile (name is required).</p>";
  }
}
