import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getTemplate, renderResumeHtml } from "@gars/template-engine";
import type { MasterProfile } from "@gars/resume-schema";
import { defaultLayout, override, toResumeDocument } from "../resume-settings";
import { SAMPLE_PROFILE } from "../sample-profile";
import { loadPrimaryProfileCore } from "./profile";

export type PreviewSource = "profile" | "sample";

const hasContent = (p: MasterProfile) => Boolean(p.personal.fullName?.trim()) && (p.experience.length > 0 || p.education.length > 0 || p.skills.length > 0);

/**
 * One template rendered with the same engine as the PDF/preview, filled with the signed-in user's saved profile.
 * If the profile has no content yet (or there is no user), a fictional sample persona is used so the template is still visible.
 */
export async function templatePreview(supabase: SupabaseClient | null, user: User | null, templateId: string, origin: string): Promise<{ html: string; source: PreviewSource } | null> {
  const template = getTemplate(templateId);
  if (!template) return null;

  let profile: MasterProfile = SAMPLE_PROFILE;
  let source: PreviewSource = "sample";
  if (supabase && user) {
    const loaded = await loadPrimaryProfileCore(supabase, user).catch(() => null);
    if (loaded && hasContent(loaded.profile)) { profile = loaded.profile; source = "profile"; }
  }

  const country = (profile.personal.location?.country ?? "US").toUpperCase();
  let layout = defaultLayout(/^[A-Z]{2}$/.test(country) ? country : "US", "en", { title: profile.personal.fullName || "Preview", premiumAllowed: true, hasPhoto: false });
  layout = override(layout, "templateId", template.id);
  try {
    const doc = toResumeDocument("preview", layout, profile);
    const html = renderResumeHtml(doc, template, {}).replace("<head>", `<head><meta name="viewport" content="width=820"><link rel="stylesheet" href="${origin}/fonts/fonts.css">`);
    return { html, source };
  } catch {
    return null;
  }
}
