import type { SectionKey } from "@gars/resume-schema";
import { CountryRule } from "./schema";
import { COUNTRY_RULE_DATA } from "./data";

export * from "./schema";

/** Neutral international defaults used for countries without a configuration yet. */
export const INTERNATIONAL_DEFAULT: CountryRule = CountryRule.parse({
  countryCode: "ZZ",
  name: "International",
  suggestedResumeLocales: ["en"],
  pageSize: "A4",
  typicalPages: { min: 1, max: 2 },
  documentName: "cv",
  dateFormat: "MMM YYYY",
  sectionOrder: ["summary", "experience", "education", "skills", "certifications", "languages", "projects", "awards", "volunteer", "publications", "references", "custom"],
  photo: "optional",
  personalInfo: { dateOfBirth: "omit", nationality: "optional", maritalStatus: "omit", gender: "omit", visaOrWorkStatus: "optional", fullAddress: "omit" },
  recommendedTemplateCategories: ["ats_minimal", "international", "modern"],
  sources: [{ title: "Résumé — national conventions (overview)", url: "https://en.wikipedia.org/wiki/R%C3%A9sum%C3%A9", kind: "editorial" }],
  reviewStatus: "unreviewed",
  lastReviewed: "2026-11-21",
});

const RULES: ReadonlyMap<string, CountryRule> = new Map(
  COUNTRY_RULE_DATA.map((r) => {
    const parsed = CountryRule.parse(r);
    return [parsed.countryCode, parsed] as const;
  }),
);

export function listCountryRules(): CountryRule[] {
  return [...RULES.values()];
}

export function getCountryRule(countryCode: string): CountryRule | undefined {
  return RULES.get(countryCode.toUpperCase());
}

/** User choices that override country suggestions. Every recommendation is overridable. */
export interface ResumePreferenceOverrides {
  pageSize?: "A4" | "Letter";
  sectionOrder?: SectionKey[];
  includePhoto?: boolean;
  resumeLocale?: string;
  dateFormat?: CountryRule["dateFormat"];
}

export interface ResumeRecommendation {
  countryCode: string;
  isFallback: boolean;
  pageSize: "A4" | "Letter";
  sectionOrder: SectionKey[];
  dateFormat: CountryRule["dateFormat"];
  /** Default for the photo toggle. Only `expected`/`common` start enabled — and only if the user has a photo. */
  includePhoto: boolean;
  photoConvention: CountryRule["photo"];
  resumeLocale: string;
  suggestedResumeLocales: string[];
  /** Personal fields worth offering in the form (never required). */
  offeredPersonalFields: (keyof CountryRule["personalInfo"])[];
  recommendedTemplateCategories: string[];
  overridden: (keyof ResumePreferenceOverrides)[];
  reviewStatus: CountryRule["reviewStatus"];
}

/**
 * Resolve resume settings for a country. NOTE: this never touches the APP language —
 * resume language and app language are independent (docs/localization/GLOBAL_LANGUAGE_STRATEGY.md).
 *
 * Resume language default: the user's current app/profile language if the country accepts it,
 * otherwise the country's first suggested language. So an English-speaking user picking Saudi Arabia
 * gets an English resume by default, with Arabic offered.
 */
export function recommendResumeSettings(
  countryCode: string,
  opts: { preferredLocale?: string; hasPhoto?: boolean; overrides?: ResumePreferenceOverrides } = {},
): ResumeRecommendation {
  const found = getCountryRule(countryCode);
  const rule = found ?? INTERNATIONAL_DEFAULT;
  const o = opts.overrides ?? {};
  const preferredBase = opts.preferredLocale?.split("-")[0];
  const defaultLocale =
    preferredBase && rule.suggestedResumeLocales.includes(preferredBase) ? preferredBase : rule.suggestedResumeLocales[0]!;

  const overridden = (Object.keys(o) as (keyof ResumePreferenceOverrides)[]).filter((k) => o[k] !== undefined);

  return {
    countryCode: found ? rule.countryCode : countryCode.toUpperCase(),
    isFallback: !found,
    pageSize: o.pageSize ?? rule.pageSize,
    sectionOrder: o.sectionOrder ?? [...rule.sectionOrder],
    dateFormat: o.dateFormat ?? rule.dateFormat,
    includePhoto: o.includePhoto ?? (Boolean(opts.hasPhoto) && (rule.photo === "expected" || rule.photo === "common")),
    photoConvention: rule.photo,
    resumeLocale: o.resumeLocale ?? defaultLocale,
    suggestedResumeLocales: [...rule.suggestedResumeLocales],
    offeredPersonalFields: (Object.entries(rule.personalInfo) as [keyof CountryRule["personalInfo"], CountryRule["photo"]][])
      .filter(([, v]) => v !== "omit")
      .map(([k]) => k),
    recommendedTemplateCategories: [...rule.recommendedTemplateCategories],
    overridden,
    reviewStatus: rule.reviewStatus,
  };
}

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Format a partial date (YYYY | YYYY-MM | YYYY-MM-DD) per country convention. Year-only stays year-only. */
export function formatResumeDate(partial: string, format: CountryRule["dateFormat"], monthNames: string[] = MONTHS_EN): string {
  const [y, m] = partial.split("-");
  if (!y) return "";
  if (!m) return format === "YYYY年MM月" ? `${y}年` : y;
  switch (format) {
    case "MM/YYYY": return `${m}/${y}`;
    case "MM.YYYY": return `${m}.${y}`;
    case "YYYY-MM": return `${y}-${m}`;
    case "YYYY.MM": return `${y}.${m}`;
    case "YYYY年MM月": return `${y}年${Number(m)}月`;
    case "MMM YYYY": return `${monthNames[Number(m) - 1] ?? m} ${y}`;
  }
}
