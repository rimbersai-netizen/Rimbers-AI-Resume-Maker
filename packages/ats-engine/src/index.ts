/**
 * Transparent, heuristic resume analysis. It estimates how parse-friendly and complete a resume is
 * and how well it aligns with a job description. It does NOT reproduce any employer's proprietary
 * ATS and must never be presented as a guarantee.
 */
import type { MasterProfile } from "@gars/resume-schema";
import { extractKeywords, matchKeywords, type KeywordMatch } from "./keywords";

export * from "./keywords";

export const ENGINE_VERSION = "ats-heuristic-1.0.0";
export const DISCLAIMER =
  "This is an estimated, explainable check based on common applicant-tracking practices. Employers use different systems; no score guarantees a resume will pass any specific ATS.";

export type Severity = "info" | "warning" | "critical";
export interface Finding {
  id: string;
  severity: Severity;
  message: string;
  suggestion?: string;
}
export type CategoryId = "contact" | "completeness" | "experience" | "readability" | "formatting" | "job_match";
export interface CategoryResult {
  id: CategoryId;
  label: string;
  score: number;
  weight: number;
  findings: Finding[];
}
export interface TemplateTraits {
  columns: 1 | 2;
  usesTables: boolean;
  usesIconsForText: boolean;
  usesGraphicsForSkills: boolean;
  headingsAreText: boolean;
}
export interface AnalysisInput {
  profile: MasterProfile;
  template?: TemplateTraits;
  jobDescription?: string;
  /** Text extracted back from the exported PDF, if available (export pipeline check). */
  extractedText?: string;
  /** Item ids hidden in this resume version. */
  hiddenItemIds?: string[];
}
export interface AnalysisResult {
  engineVersion: string;
  overall: number;
  band: "needs_work" | "fair" | "good" | "strong";
  categories: CategoryResult[];
  keywordMatch?: KeywordMatch;
  disclaimer: string;
}

const ACTION_VERBS = new Set(("led managed built designed developed implemented created launched delivered improved increased reduced " +
  "optimized optimised automated coordinated negotiated analyzed analysed established streamlined trained mentored owned drove " +
  "architected migrated resolved supervised planned executed achieved generated grew saved prepared conducted supported maintained " +
  "organized organised oversaw spearheaded introduced redesigned integrated deployed tested audited").split(" "));

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);

/** Flatten a profile to plain text — what a parser would "see" if the document renders cleanly. */
export function profileToText(p: MasterProfile, hidden: ReadonlySet<string> = new Set()): string {
  const vis = <T extends { id: string }>(xs: T[]) => xs.filter((x) => !hidden.has(x.id));
  const parts: string[] = [p.personal.fullName, p.personal.professionalTitle ?? "", p.summary ?? ""];
  for (const w of vis(p.experience)) parts.push(w.title, w.employer, w.description ?? "", ...w.bullets.map((b) => b.text));
  for (const e of vis(p.education)) parts.push(e.qualification, e.field ?? "", e.institution);
  parts.push(...vis(p.skills).map((s) => s.name), ...vis(p.certifications).map((c) => c.name), ...vis(p.languages).map((l) => l.language));
  for (const pr of vis(p.projects)) parts.push(pr.name, pr.description ?? "");
  return parts.filter(Boolean).join("\n");
}

function contact(p: MasterProfile): CategoryResult {
  const f: Finding[] = [];
  let s = 100;
  if (!p.personal.email) { s -= 40; f.push({ id: "contact.email_missing", severity: "critical", message: "No email address.", suggestion: "Add a professional email address." }); }
  if (!p.personal.phone) { s -= 25; f.push({ id: "contact.phone_missing", severity: "warning", message: "No phone number.", suggestion: "Add a phone number with country code." }); }
  if (!p.personal.location.city && !p.personal.location.country) { s -= 15; f.push({ id: "contact.location_missing", severity: "warning", message: "No location.", suggestion: "City and country are enough; a full address is rarely needed." }); }
  if (!p.personal.linkedin) { s -= 5; f.push({ id: "contact.linkedin_missing", severity: "info", message: "No LinkedIn profile link.", suggestion: "Recruiters often check LinkedIn." }); }
  if (!p.personal.professionalTitle) { s -= 15; f.push({ id: "contact.title_missing", severity: "warning", message: "No professional title under your name.", suggestion: "Add a title that matches the roles you target." }); }
  return { id: "contact", label: "Contact information", score: clamp(s), weight: 15, findings: f };
}

function completeness(p: MasterProfile, hidden: ReadonlySet<string>): CategoryResult {
  const f: Finding[] = [];
  let s = 100;
  const exp = p.experience.filter((x) => !hidden.has(x.id));
  const skills = p.skills.filter((x) => !hidden.has(x.id));
  if (!p.summary?.trim()) { s -= 20; f.push({ id: "complete.summary_missing", severity: "warning", message: "No professional summary.", suggestion: "Add 2–4 sentences on your experience and focus." }); }
  if (exp.length === 0) { s -= 35; f.push({ id: "complete.experience_missing", severity: "critical", message: "No work experience listed.", suggestion: "Add roles, internships, or relevant projects." }); }
  if (p.education.length === 0) { s -= 20; f.push({ id: "complete.education_missing", severity: "warning", message: "No education listed." }); }
  if (skills.length < 3) { s -= 20; f.push({ id: "complete.skills_few", severity: "warning", message: `Only ${skills.length} skill(s) listed.`, suggestion: "List the skills you actually use (6–15 is typical)." }); }
  const undated = exp.filter((x) => !x.dates.start);
  if (undated.length) { s -= 10; f.push({ id: "complete.dates_missing", severity: "warning", message: `${undated.length} role(s) without a start date.`, suggestion: "Parsers use dates to calculate experience." }); }
  return { id: "completeness", label: "Section completeness", score: clamp(s), weight: 20, findings: f };
}

function experienceQuality(p: MasterProfile, hidden: ReadonlySet<string>): CategoryResult {
  const f: Finding[] = [];
  const exp = p.experience.filter((x) => !hidden.has(x.id));
  const bullets = exp.flatMap((x) => x.bullets.map((b) => b.text));
  if (exp.length === 0) return { id: "experience", label: "Experience content", score: 0, weight: 20, findings: [{ id: "exp.none", severity: "critical", message: "No experience to evaluate." }] };
  let s = 100;
  const thin = exp.filter((x) => x.bullets.length < 2 && !(x.description && words(x.description).length >= 20));
  if (thin.length) { s -= Math.min(30, thin.length * 10); f.push({ id: "exp.thin_roles", severity: "warning", message: `${thin.length} role(s) have fewer than 2 bullet points.`, suggestion: "Describe 2–5 responsibilities or results per role." }); }
  const firstWord = (t: string) => (t.toLowerCase().match(/^[\p{L}]+/u)?.[0] ?? "");
  const weakStart = bullets.filter((b) => !ACTION_VERBS.has(firstWord(b)));
  if (bullets.length && weakStart.length / bullets.length > 0.5) { s -= 15; f.push({ id: "exp.weak_verbs", severity: "info", message: "Most bullets don't start with an action verb.", suggestion: "Start with verbs such as Led, Built, Reduced, Improved." }); }
  const quantified = bullets.filter((b) => /\d/.test(b));
  if (bullets.length >= 3 && quantified.length === 0) {
    s -= 15;
    // Never invent numbers — only invite the user to add real ones.
    f.push({ id: "exp.no_metrics", severity: "info", message: "No measurable results found.", suggestion: "Where you genuinely know them, add real figures (team size, time saved, volume). Do not estimate figures you cannot support." });
  }
  const long = bullets.filter((b) => words(b).length > 40);
  if (long.length) { s -= 10; f.push({ id: "exp.long_bullets", severity: "info", message: `${long.length} bullet(s) exceed 40 words.`, suggestion: "Keep bullets to one or two lines." }); }
  const order = exp.filter((x) => x.dates.start).map((x) => x.dates.start!);
  if (order.some((d, i) => i > 0 && d > order[i - 1]!)) { s -= 10; f.push({ id: "exp.not_reverse_chrono", severity: "warning", message: "Roles are not in reverse-chronological order.", suggestion: "List your most recent role first." }); }
  return { id: "experience", label: "Experience content", score: clamp(s), weight: 20, findings: f };
}

function readability(p: MasterProfile): CategoryResult {
  const f: Finding[] = [];
  let s = 100;
  const sw = p.summary ? words(p.summary).length : 0;
  if (sw > 120) { s -= 20; f.push({ id: "read.summary_long", severity: "info", message: `Summary is ${sw} words.`, suggestion: "Aim for 40–100 words." }); }
  else if (sw > 0 && sw < 15) { s -= 10; f.push({ id: "read.summary_short", severity: "info", message: "Summary is very short." }); }
  const all = [p.summary ?? "", ...p.experience.flatMap((x) => x.bullets.map((b) => b.text))].join(" ");
  if (/[A-Z]{12,}/.test(all)) { s -= 10; f.push({ id: "read.all_caps", severity: "info", message: "Long ALL-CAPS text is harder to read." }); }
  if (/[☀-➿\u{1F300}-\u{1FAFF}]/u.test(all)) { s -= 15; f.push({ id: "read.emoji", severity: "warning", message: "Emoji or symbols in body text may not parse.", suggestion: "Use plain text." }); }
  return { id: "readability", label: "Readability", score: clamp(s), weight: 10, findings: f };
}

function formatting(t: TemplateTraits | undefined, extracted: string | undefined, p: MasterProfile): CategoryResult {
  const f: Finding[] = [];
  let s = 100;
  if (t) {
    if (t.columns === 2) { s -= 10; f.push({ id: "fmt.two_columns", severity: "info", message: "Two-column layout.", suggestion: "Most modern parsers handle it, but a single column is the safest choice." }); }
    if (t.usesTables) { s -= 20; f.push({ id: "fmt.tables", severity: "warning", message: "Layout uses tables for content.", suggestion: "Choose an ATS Minimal template for online applications." }); }
    if (t.usesIconsForText) { s -= 15; f.push({ id: "fmt.icon_labels", severity: "warning", message: "Icons replace text labels (e.g. phone icon instead of “Phone”)." }); }
    if (t.usesGraphicsForSkills) { s -= 15; f.push({ id: "fmt.skill_graphics", severity: "warning", message: "Skill levels shown as bars or dots are not readable by parsers." }); }
    if (!t.headingsAreText) { s -= 30; f.push({ id: "fmt.image_headings", severity: "critical", message: "Section headings are not real text." }); }
  } else {
    f.push({ id: "fmt.unknown_template", severity: "info", message: "Template not evaluated." });
  }
  if (extracted !== undefined) {
    const expected = [p.personal.fullName, p.personal.email].filter((x): x is string => Boolean(x));
    const lost = expected.filter((x) => !extracted.includes(x));
    if (extracted.trim().length < 50 || lost.length) {
      s -= 40;
      f.push({ id: "fmt.extraction_failed", severity: "critical", message: "Text could not be fully extracted from the exported file.", suggestion: "Re-export, or pick a simpler template." });
    }
  }
  return { id: "formatting", label: "Formatting & parsing", score: clamp(s), weight: 15, findings: f };
}

function jobMatch(km: KeywordMatch): CategoryResult {
  const f: Finding[] = [];
  if (km.missingRequired.length) {
    f.push({
      id: "match.missing_required", severity: "critical",
      message: `Required terms not found: ${km.missingRequired.map((k) => k.term).join(", ")}.`,
      suggestion: "Add them only if you genuinely have this experience — never claim skills you don't have.",
    });
  }
  const optional = km.missing.filter((k) => !k.required).slice(0, 8);
  if (optional.length) f.push({ id: "match.missing_terms", severity: "info", message: `Other job terms not found: ${optional.map((k) => k.term).join(", ")}.` });
  if (km.matched.length) f.push({ id: "match.matched", severity: "info", message: `Matched: ${km.matched.map((k) => k.term).join(", ")}.` });
  return { id: "job_match", label: "Job description match", score: km.score, weight: 30, findings: f };
}

export function analyzeResume(input: AnalysisInput): AnalysisResult {
  const hidden = new Set(input.hiddenItemIds ?? []);
  const p = input.profile;
  const categories = [contact(p), completeness(p, hidden), experienceQuality(p, hidden), readability(p), formatting(input.template, input.extractedText, p)];
  let keywordMatch: KeywordMatch | undefined;
  if (input.jobDescription?.trim()) {
    keywordMatch = matchKeywords(extractKeywords(input.jobDescription), profileToText(p, hidden));
    categories.push(jobMatch(keywordMatch));
  }
  const wsum = categories.reduce((s, c) => s + c.weight, 0);
  const overall = clamp(categories.reduce((s, c) => s + c.score * c.weight, 0) / wsum);
  const band = overall >= 85 ? "strong" : overall >= 70 ? "good" : overall >= 50 ? "fair" : "needs_work";
  return { engineVersion: ENGINE_VERSION, overall, band, categories, keywordMatch, disclaimer: DISCLAIMER };
}

/** Before/after comparison for accepted suggestions. */
export function compareAnalyses(before: AnalysisResult, after: AnalysisResult) {
  return {
    overallDelta: after.overall - before.overall,
    categories: after.categories.map((c) => {
      const b = before.categories.find((x) => x.id === c.id);
      return { id: c.id, before: b?.score ?? null, after: c.score, delta: b ? c.score - b.score : null };
    }),
    resolvedFindings: before.categories.flatMap((c) => c.findings).filter((fb) => !after.categories.some((c) => c.findings.some((fa) => fa.id === fb.id))).map((x) => x.id),
  };
}
