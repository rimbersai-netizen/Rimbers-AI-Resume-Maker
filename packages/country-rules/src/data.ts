import type { CountryRuleInput } from "./schema";

/**
 * Initial 30 country conventions.
 * Compiled from general hiring-practice knowledge on 2026-11-21. ALL entries are `unreviewed`:
 * they must be checked by a human reviewer (admin → Country Rules) before being marked reviewed.
 * Sources are entry points for that review, not proof of every individual value.
 */

const REVIEWED = "2026-11-21";

const SRC = {
  wiki: { title: "Résumé — national conventions (overview)", url: "https://en.wikipedia.org/wiki/R%C3%A9sum%C3%A9", kind: "editorial" },
  europass: { title: "Europass (European Union)", url: "https://europass.europa.eu/", kind: "intergovernmental" },
  us: { title: "CareerOneStop (U.S. Department of Labor)", url: "https://www.careeronestop.org/", kind: "government" },
  uk: { title: "National Careers Service (UK)", url: "https://nationalcareers.service.gov.uk/", kind: "government" },
  ca: { title: "Job Bank (Government of Canada)", url: "https://www.jobbank.gc.ca/", kind: "government" },
  de: { title: "Make it in Germany (German Federal Government)", url: "https://www.make-it-in-germany.com/", kind: "government" },
  ie: { title: "Citizens Information (Ireland)", url: "https://www.citizensinformation.ie/", kind: "government" },
  ch: { title: "ch.ch (Swiss authorities portal)", url: "https://www.ch.ch/", kind: "government" },
  au: { title: "Workforce Australia", url: "https://www.workforceaustralia.gov.au/", kind: "government" },
  nz: { title: "Careers New Zealand", url: "https://www.careers.govt.nz/", kind: "government" },
  in: { title: "National Career Service (India)", url: "https://www.ncs.gov.in/", kind: "government" },
  sg: { title: "MyCareersFuture (Singapore)", url: "https://www.mycareersfuture.gov.sg/", kind: "government" },
  jp: { title: "Hello Work (Ministry of Health, Labour and Welfare)", url: "https://www.hellowork.mhlw.go.jp/", kind: "government" },
} as const;

type Preset = Omit<CountryRuleInput, "countryCode" | "name" | "suggestedResumeLocales" | "sources" | "reviewStatus" | "lastReviewed">;

const ORDER_STANDARD = ["summary", "experience", "education", "skills", "certifications", "languages", "projects", "awards", "volunteer", "publications", "references", "custom"] as const;
const ORDER_EDU_FIRST = ["summary", "education", "experience", "skills", "languages", "certifications", "projects", "publications", "awards", "volunteer", "references", "custom"] as const;
const ORDER_SKILLS_EARLY = ["summary", "skills", "experience", "education", "certifications", "languages", "projects", "awards", "volunteer", "publications", "references", "custom"] as const;

const NA: Preset = {
  pageSize: "Letter", typicalPages: { min: 1, max: 2 }, documentName: "resume", dateFormat: "MMM YYYY",
  sectionOrder: [...ORDER_STANDARD], photo: "omit",
  personalInfo: { dateOfBirth: "omit", nationality: "omit", maritalStatus: "omit", gender: "omit", visaOrWorkStatus: "optional", fullAddress: "omit" },
  recommendedTemplateCategories: ["ats_minimal", "modern", "corporate", "technical"],
  notes: ["Anti-discrimination norms: leave out photo, age, marital status.", "City/region is enough for location."],
};

const UK_IE_ANZ: Preset = {
  ...NA, pageSize: "A4", typicalPages: { min: 2, max: 2 }, documentName: "cv",
  notes: ["Two pages is typical for experienced candidates.", "Photo and personal details are usually left out."],
};

const DACH: Preset = {
  pageSize: "A4", typicalPages: { min: 1, max: 3 }, documentName: "cv", dateFormat: "MM.YYYY",
  sectionOrder: [...ORDER_STANDARD], photo: "common",
  personalInfo: { dateOfBirth: "optional", nationality: "optional", maritalStatus: "omit", gender: "omit", visaOrWorkStatus: "optional", fullAddress: "common" },
  recommendedTemplateCategories: ["classic", "corporate", "modern", "ats_minimal"],
  notes: ["Tabular, reverse-chronological CV (Lebenslauf) is common.", "A professional photo is common but not required; it is never mandatory."],
};

const EU_SOUTH: Preset = {
  ...DACH, dateFormat: "MM/YYYY",
  notes: ["Photo is common but optional.", "Europass format is accepted by some employers."],
};

const EU_NORTH: Preset = {
  ...DACH, dateFormat: "MM/YYYY", typicalPages: { min: 1, max: 2 }, photo: "optional",
  personalInfo: { dateOfBirth: "omit", nationality: "optional", maritalStatus: "omit", gender: "omit", visaOrWorkStatus: "optional", fullAddress: "optional" },
  recommendedTemplateCategories: ["modern", "ats_minimal", "corporate", "creative"],
  notes: ["Concise CVs are preferred; a personal profile at the top is common."],
};

const GCC: Preset = {
  pageSize: "A4", typicalPages: { min: 2, max: 3 }, documentName: "cv", dateFormat: "MM/YYYY",
  sectionOrder: [...ORDER_STANDARD], photo: "common",
  personalInfo: { dateOfBirth: "common", nationality: "common", maritalStatus: "optional", gender: "optional", visaOrWorkStatus: "common", fullAddress: "optional" },
  recommendedTemplateCategories: ["corporate", "international", "executive", "engineering"],
  notes: [
    "Nationality and visa/transferability status are frequently included.",
    "English CVs are widely accepted; an Arabic version is useful for government and local employers.",
    "All personal fields remain optional; the user decides.",
  ],
};

const SOUTH_ASIA: Preset = {
  pageSize: "A4", typicalPages: { min: 2, max: 3 }, documentName: "cv", dateFormat: "MMM YYYY",
  sectionOrder: [...ORDER_STANDARD], photo: "optional",
  personalInfo: { dateOfBirth: "optional", nationality: "optional", maritalStatus: "optional", gender: "optional", visaOrWorkStatus: "optional", fullAddress: "optional" },
  recommendedTemplateCategories: ["classic", "corporate", "ats_minimal", "graduate"],
  notes: ["Many multinational employers now prefer the international (ATS) style without personal details."],
};

const SEA: Preset = {
  ...SOUTH_ASIA, photo: "common", typicalPages: { min: 1, max: 2 },
  recommendedTemplateCategories: ["modern", "corporate", "ats_minimal"],
};

const EAST_ASIA: Preset = {
  pageSize: "A4", typicalPages: { min: 1, max: 2 }, documentName: "resume", dateFormat: "YYYY.MM",
  sectionOrder: [...ORDER_EDU_FIRST], photo: "expected",
  personalInfo: { dateOfBirth: "common", nationality: "optional", maritalStatus: "omit", gender: "optional", visaOrWorkStatus: "optional", fullAddress: "common" },
  recommendedTemplateCategories: ["classic", "corporate", "international"],
  notes: ["Local employers often use standardized forms; an English resume is used by foreign-affiliated companies."],
};

type Row = [code: string, name: string, locales: string[], preset: Preset, sources: (keyof typeof SRC)[], patch?: Partial<Preset>];

const ROWS: Row[] = [
  ["SA", "Saudi Arabia", ["en", "ar"], GCC, ["wiki"]],
  ["AE", "United Arab Emirates", ["en", "ar"], GCC, ["wiki"]],
  ["QA", "Qatar", ["en", "ar"], GCC, ["wiki"]],
  ["KW", "Kuwait", ["en", "ar"], GCC, ["wiki"]],
  ["BH", "Bahrain", ["en", "ar"], GCC, ["wiki"]],
  ["OM", "Oman", ["en", "ar"], GCC, ["wiki"]],
  ["US", "United States", ["en"], NA, ["us", "wiki"]],
  ["CA", "Canada", ["en", "fr"], NA, ["ca", "wiki"]],
  ["GB", "United Kingdom", ["en"], UK_IE_ANZ, ["uk", "wiki"]],
  ["IE", "Ireland", ["en"], UK_IE_ANZ, ["ie", "europass"]],
  ["AU", "Australia", ["en"], UK_IE_ANZ, ["au", "wiki"], { typicalPages: { min: 2, max: 3 }, dateFormat: "MMM YYYY" }],
  ["NZ", "New Zealand", ["en"], UK_IE_ANZ, ["nz", "wiki"]],
  ["DE", "Germany", ["de", "en"], DACH, ["de", "europass"]],
  ["CH", "Switzerland", ["de", "fr", "it", "en"], DACH, ["ch", "wiki"]],
  ["FR", "France", ["fr", "en"], EU_SOUTH, ["europass", "wiki"], { typicalPages: { min: 1, max: 2 } }],
  ["IT", "Italy", ["it", "en"], EU_SOUTH, ["europass", "wiki"]],
  ["ES", "Spain", ["es", "en"], EU_SOUTH, ["europass", "wiki"]],
  ["NL", "Netherlands", ["nl", "en"], EU_NORTH, ["europass", "wiki"]],
  ["SE", "Sweden", ["sv", "en"], EU_NORTH, ["europass", "wiki"]],
  ["NO", "Norway", ["nb", "en"], EU_NORTH, ["europass", "wiki"]],
  ["DK", "Denmark", ["da", "en"], EU_NORTH, ["europass", "wiki"]],
  ["FI", "Finland", ["fi", "en"], EU_NORTH, ["europass", "wiki"]],
  ["IN", "India", ["en", "hi"], SOUTH_ASIA, ["in", "wiki"]],
  ["PK", "Pakistan", ["en", "ur"], SOUTH_ASIA, ["wiki"]],
  ["BD", "Bangladesh", ["en", "bn"], SOUTH_ASIA, ["wiki"]],
  ["PH", "Philippines", ["en"], SEA, ["wiki"], { pageSize: "Letter" }],
  ["SG", "Singapore", ["en"], SEA, ["sg", "wiki"], { photo: "optional", sectionOrder: [...ORDER_SKILLS_EARLY] }],
  ["MY", "Malaysia", ["en", "ms"], SEA, ["wiki"]],
  ["JP", "Japan", ["ja", "en"], EAST_ASIA, ["jp", "wiki"], { dateFormat: "YYYY年MM月" }],
  ["KR", "South Korea", ["ko", "en"], EAST_ASIA, ["wiki"]],
];

export const COUNTRY_RULE_DATA: CountryRuleInput[] = ROWS.map(([countryCode, name, locales, preset, sources, patch]) => ({
  ...preset,
  ...patch,
  personalInfo: { ...preset.personalInfo },
  sectionOrder: [...(patch?.sectionOrder ?? preset.sectionOrder)],
  countryCode,
  name,
  suggestedResumeLocales: locales,
  sources: sources.map((s) => ({ ...SRC[s] })),
  reviewStatus: "unreviewed",
  lastReviewed: REVIEWED,
}));
