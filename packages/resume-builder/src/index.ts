/**
 * Resume layout logic (pure). Country → recommendations; user overrides always win and survive country changes.
 * The APP language is never modified here: resume language is a separate, per-resume setting.
 */
import { getCountryRule, recommendResumeSettings } from "@gars/country-rules";
import { SECTION_KEYS, type MasterProfile, type ResumeDocument, type SectionKey } from "@gars/resume-schema";
import { SUPPORTED_LOCALES } from "@gars/shared-types";
import { getTemplate, recommendTemplates } from "@gars/template-engine";

export type OverridableField = "locale" | "pageSize" | "includePhoto" | "sectionOrder" | "templateId" | "dateFormat";

export interface SectionSetting { key: SectionKey; visible: boolean; heading?: string }

export interface ResumeLayout {
  title: string;
  countryCode: string;
  locale: string;
  templateId: string;
  pageSize: "A4" | "Letter";
  includePhoto: boolean;
  settings: { hiddenItemIds: string[]; dateFormat?: string; overridden: OverridableField[] };
  sections: SectionSetting[];
}

/** Resume languages offered; country suggestions are listed first in the UI. */
export const RESUME_LOCALES: readonly string[] = SUPPORTED_LOCALES;

export function localeLabel(code: string, inLocale = "en"): string {
  try {
    const own = new Intl.DisplayNames([code], { type: "language" }).of(code);
    const en = new Intl.DisplayNames([inLocale], { type: "language" }).of(code);
    return own && en && own !== en ? `${en} — ${own}` : en ?? code;
  } catch { return code; }
}

export function countryLabel(code: string, inLocale = "en"): string {
  try { return new Intl.DisplayNames([inLocale], { type: "region" }).of(code) ?? code; } catch { return getCountryRule(code)?.name ?? code; }
}

/** Regional-indicator flag emoji for an ISO country code (decorative only). */
export const flag = (code: string) => String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));

function sectionsFrom(order: readonly SectionKey[]): SectionSetting[] {
  const rest = SECTION_KEYS.filter((k) => !order.includes(k));
  return [...order, ...rest].map((key) => ({ key, visible: true }));
}

export function defaultLayout(countryCode: string, appLocale: string, opts: { hasPhoto?: boolean; title?: string; premiumAllowed?: boolean } = {}): ResumeLayout {
  const rec = recommendResumeSettings(countryCode, { preferredLocale: appLocale, hasPhoto: opts.hasPhoto });
  const tpl = recommendTemplates(rec.recommendedTemplateCategories, { includePremium: opts.premiumAllowed })[0]!;
  return {
    title: opts.title ?? `${countryLabel(rec.countryCode)} ${getCountryRule(rec.countryCode)?.documentName === "resume" ? "Resume" : "CV"}`,
    countryCode: rec.countryCode,
    locale: rec.resumeLocale,
    templateId: tpl.id,
    pageSize: rec.pageSize,
    includePhoto: rec.includePhoto,
    settings: { hiddenItemIds: [], overridden: [] },
    sections: sectionsFrom(rec.sectionOrder),
  };
}

/** User explicitly changed a field: apply it and remember it so country changes won't reset it. */
export function override<K extends keyof ResumeLayout>(layout: ResumeLayout, field: K & OverridableField, value: ResumeLayout[K]): ResumeLayout {
  const overridden = layout.settings.overridden.includes(field) ? layout.settings.overridden : [...layout.settings.overridden, field];
  return { ...layout, [field]: value, settings: { ...layout.settings, overridden } };
}

export function overrideSections(layout: ResumeLayout, sections: SectionSetting[]): ResumeLayout {
  const overridden = layout.settings.overridden.includes("sectionOrder") ? layout.settings.overridden : [...layout.settings.overridden, "sectionOrder" as const];
  return { ...layout, sections, settings: { ...layout.settings, overridden } };
}

/** Change country: re-apply its recommendations for every field the user has NOT overridden. */
export function changeCountry(layout: ResumeLayout, countryCode: string, appLocale: string, opts: { hasPhoto?: boolean; premiumAllowed?: boolean } = {}): ResumeLayout {
  const fresh = defaultLayout(countryCode, appLocale, { ...opts, title: layout.title });
  const keep = (f: OverridableField) => layout.settings.overridden.includes(f);
  return {
    ...layout,
    countryCode: fresh.countryCode,
    locale: keep("locale") ? layout.locale : fresh.locale,
    pageSize: keep("pageSize") ? layout.pageSize : fresh.pageSize,
    includePhoto: keep("includePhoto") ? layout.includePhoto : fresh.includePhoto,
    templateId: keep("templateId") ? layout.templateId : fresh.templateId,
    sections: keep("sectionOrder") ? layout.sections : fresh.sections,
    settings: { ...layout.settings, dateFormat: keep("dateFormat") ? layout.settings.dateFormat : undefined },
  };
}

/** What the renderer needs: master profile + this resume's presentation choices. */
export function toResumeDocument(id: string, layout: ResumeLayout, profile: MasterProfile): ResumeDocument {
  const visible = layout.sections.filter((s) => s.visible).map((s) => s.key);
  return {
    schemaVersion: 1,
    id,
    title: layout.title,
    country: layout.countryCode,
    locale: layout.locale as ResumeDocument["locale"],
    templateId: layout.templateId,
    pageSize: layout.pageSize,
    sectionOrder: visible.length ? visible : ["summary"],
    hiddenItemIds: layout.settings.hiddenItemIds,
    includePhoto: layout.includePhoto,
    profile,
  };
}

/** Explain the country recommendation in plain words for the UI (conventions, not rules). */
export function recommendationNotes(countryCode: string): string[] {
  const r = getCountryRule(countryCode);
  if (!r) return ["No specific conventions recorded for this country yet — international defaults are used."];
  const photo = { omit: "Photos are usually left out", optional: "A photo is optional", common: "A photo is common (never required)", expected: "A photo is usually expected" }[r.photo];
  return [
    `${r.pageSize} paper, typically ${r.typicalPages.min === r.typicalPages.max ? r.typicalPages.min : `${r.typicalPages.min}–${r.typicalPages.max}`} page(s)`,
    photo,
    `Dates shown as ${r.dateFormat}`,
    ...r.notes,
  ];
}

export const isPremiumTemplate = (id: string) => Boolean(getTemplate(id)?.premium);
