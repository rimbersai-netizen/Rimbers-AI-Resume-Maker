/**
 * AI job contract (shared by web + ai-worker) and execution with the factual-traceability gate.
 */
import { z } from "zod";
import type { MasterProfile } from "@gars/resume-schema";
import { SUPPORTED_LOCALES } from "@gars/shared-types";
import { AiError, type AiProvider } from "./provider";
import { routeGenerate, type RouteConfig } from "./router";
import { extractKeywords, matchKeywords, profileToText } from "@gars/ats-engine";
import { isSkillLikeTerm } from "./factcheck";
import { withSignature } from "./tasks";
import { buildLinkedInAboutTask, buildLinkedInHeadlineTask } from "./tasks";
import { buildCoverLetterTask, buildInterviewPrepTask, buildPolishTask, buildRewriteBulletsTask, buildSummaryTask, buildTailorSummaryTask, Length, Tone } from "./tasks";
import type { Violation } from "./factcheck";
import { buildImportTask, extractedToProfile, IMPORT_MAX_CHARS } from "./import";

const Target = z.discriminatedUnion("type", [z.object({ type: z.literal("summary") }), z.object({ type: z.literal("bullets"), experienceId: z.string().min(1).max(64) })]);
const base = { masterProfileId: z.string().uuid(), locale: z.enum(SUPPORTED_LOCALES) };
export const AiJobInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("summary"), ...base, tone: Tone, length: Length, targetRole: z.string().max(120).optional() }),
  z.object({ kind: z.literal("achievement_bullets"), ...base, experienceId: z.string().min(1).max(64), tone: Tone }),
  z.object({ kind: z.literal("grammar"), ...base, target: Target }),
  z.object({ kind: z.literal("tone"), ...base, target: Target, tone: Tone }),
  z.object({ kind: z.literal("tailor_resume"), ...base, jobDescription: z.string().trim().min(30).max(20000), tone: Tone, targetRole: z.string().max(120).optional() }),
  z.object({ kind: z.literal("cover_letter"), ...base, tone: Tone, jobTitle: z.string().trim().min(2).max(200), company: z.string().trim().max(200).optional(),
    keyPoints: z.string().trim().max(1000).optional(), jobDescription: z.string().trim().max(20000).optional() }),
  z.object({ kind: z.literal("linkedin_headline"), ...base, tone: Tone, targetRole: z.string().max(120).optional() }),
  z.object({ kind: z.literal("linkedin_about"), ...base, tone: Tone }),
  /** Professional plan only (enforced server-side before queueing and again in the worker). */
  z.object({ kind: z.literal("interview_prep"), ...base, jobTitle: z.string().trim().min(2).max(200), company: z.string().trim().max(200).optional(),
    jobDescription: z.string().trim().max(20000).optional(), count: z.number().int().min(4).max(10).default(8) }),
  /** Import an existing CV: the text was extracted server-side from the user's upload. No profile is needed (or read). */
  z.object({ kind: z.literal("import_extract"), locale: z.enum(SUPPORTED_LOCALES), text: z.string().trim().min(80).max(IMPORT_MAX_CHARS) }),
]);
export type AiJobInput = z.infer<typeof AiJobInput>;
type ProfileJobInput = Exclude<AiJobInput, { kind: "import_extract" }>;

const meta = { violations: z.array(z.any()), sourceFieldIds: z.array(z.string()) };
export const AiJobOutput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("summary"), summary: z.string(), ...meta }),
  z.object({ kind: z.literal("achievement_bullets"), experienceId: z.string(), bullets: z.array(z.string()), ...meta }),
  z.object({ kind: z.literal("polish"), mode: z.enum(["grammar", "tone"]), target: Target, summary: z.string().optional(), bullets: z.array(z.string()).optional(), ...meta }),
  /** matched/missingRequired are deterministic (ATS engine), never model-generated. */
  z.object({ kind: z.literal("tailored_summary"), summary: z.string(), matched: z.array(z.string()), missingRequired: z.array(z.string()), ...meta }),
  z.object({ kind: z.literal("cover_letter"), letter: z.string(), matched: z.array(z.string()), missingRequired: z.array(z.string()), ...meta }),
  z.object({ kind: z.literal("linkedin_headline"), headline: z.string(), ...meta }),
  z.object({ kind: z.literal("linkedin_about"), about: z.string(), ...meta }),
  /** Questions + coaching; `gaps` are job skills the user lacks (deterministic, never model-written) so they can prepare to discuss them honestly. */
  z.object({ kind: z.literal("interview_prep"), questions: z.array(z.object({ question: z.string(), category: z.string(), tip: z.string(), talkingPoints: z.array(z.string()) })), gaps: z.array(z.string()), ...meta }),
  /** Extracted + grounded profile draft. The user reviews it, then /profile/import/apply saves it. */
  z.object({ kind: z.literal("imported_profile"), profile: z.record(z.any()), dropped: z.number(),
    counts: z.object({ experience: z.number(), education: z.number(), skills: z.number(), certifications: z.number(), languages: z.number(), projects: z.number() }) }),
]);
export type AiJobOutput = z.infer<typeof AiJobOutput>;

export interface AiRunResult {
  output: AiJobOutput;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  durationMs: number;
  attempts: number;
}

const describe = (v: Violation[]) => v.filter((x) => x.severity === "block").map((x) => `${x.kind.replace("new_", "")} "${x.value}"`).join(", ");

/**
 * Run one AI job. Blocking fact violations (invented numbers/skills) trigger ONE corrective retry; if the model still
 * invents facts the job fails with `unverified_facts` — invented content is never returned to the user.
 */
type Built = { messages: import("./provider").ChatMessage[]; schema: unknown; jsonSchema: Record<string, unknown>; check: (v: unknown) => { ok: boolean; violations: Violation[] } };

type Value = { summary?: string; bullets?: string[]; letter?: string; headline?: string; about?: string; questions?: { question: string; category: string; tip: string; talkingPoints: string[] }[] };
function plan(input: ProfileJobInput, profile: MasterProfile): { task: Built; toOutput: (value: Value, violations: Violation[]) => AiJobOutput } {
  const allIds = [...profile.experience.map((w) => w.id), ...profile.education.map((e) => e.id), ...profile.skills.map((s) => s.id)];
  switch (input.kind) {
    case "summary": {
      const task = buildSummaryTask(profile, { tone: input.tone, length: input.length, locale: input.locale, targetRole: input.targetRole }) as unknown as Built;
      return { task, toOutput: (v, violations) => ({ kind: "summary", summary: v.summary!, violations, sourceFieldIds: allIds }) };
    }
    case "achievement_bullets": {
      const task = buildRewriteBulletsTask(profile, input.experienceId, { tone: input.tone, locale: input.locale }) as unknown as Built;
      return { task, toOutput: (v, violations) => ({ kind: "achievement_bullets", experienceId: input.experienceId, bullets: v.bullets!, violations, sourceFieldIds: [input.experienceId] }) };
    }
    case "grammar":
    case "tone": {
      const task = buildPolishTask(profile, input.target, { mode: input.kind, tone: input.kind === "tone" ? input.tone : undefined, locale: input.locale }) as unknown as Built;
      const ids = input.target.type === "summary" ? ["summary"] : [input.target.experienceId];
      return { task, toOutput: (v, violations) => ({ kind: "polish", mode: input.kind, target: input.target, summary: v.summary, bullets: v.bullets, violations, sourceFieldIds: ids }) };
    }
    case "tailor_resume": {
      const km = matchKeywords(extractKeywords(input.jobDescription), profileToText(profile));
      const matched = km.matched.map((k) => k.term);
      // Only skill-like missing terms are forbidden; ordinary words ("projects") would block faithful phrasing.
      const forbidden = km.missing.map((k) => k.term).filter((t) => isSkillLikeTerm(t, input.jobDescription));
      const task = buildTailorSummaryTask(profile, { matched, missing: forbidden, tone: input.tone, locale: input.locale, targetRole: input.targetRole }) as unknown as Built;
      return { task, toOutput: (v, violations) => ({ kind: "tailored_summary", summary: v.summary!, matched, missingRequired: km.missingRequired.map((k) => k.term).filter((t) => isSkillLikeTerm(t, input.jobDescription)), violations, sourceFieldIds: allIds }) };
    }
    case "linkedin_headline": {
      const task = buildLinkedInHeadlineTask(profile, { tone: input.tone, locale: input.locale, targetRole: input.targetRole }) as unknown as Built;
      return { task, toOutput: (v, violations) => ({ kind: "linkedin_headline", headline: v.headline!.replace(/\s+/g, " ").trim(), violations, sourceFieldIds: allIds }) };
    }
    case "linkedin_about": {
      const task = buildLinkedInAboutTask(profile, { tone: input.tone, locale: input.locale }) as unknown as Built;
      return { task, toOutput: (v, violations) => ({ kind: "linkedin_about", about: v.about!.trim(), violations, sourceFieldIds: allIds }) };
    }
    case "interview_prep": {
      const jd = input.jobDescription ?? "";
      const km = jd ? matchKeywords(extractKeywords(jd), profileToText(profile)) : { matched: [], missing: [], missingRequired: [] };
      const forbidden = km.missing.map((k) => k.term).filter((t) => isSkillLikeTerm(t, jd));
      const task = buildInterviewPrepTask(profile, { jobTitle: input.jobTitle, company: input.company, jobDescription: jd, count: input.count, forbidden, locale: input.locale }) as unknown as Built;
      return { task, toOutput: (v, violations) => ({ kind: "interview_prep", questions: v.questions!, gaps: km.missing.map((k) => k.term).filter((t) => isSkillLikeTerm(t, jd)).slice(0, 8), violations, sourceFieldIds: allIds }) };
    }
    case "cover_letter": {
      const jd = input.jobDescription ?? "";
      const km = jd ? matchKeywords(extractKeywords(jd), profileToText(profile)) : { matched: [], missing: [], missingRequired: [] };
      const matched = km.matched.map((k) => k.term);
      const forbidden = km.missing.map((k) => k.term).filter((t) => isSkillLikeTerm(t, jd));
      const task = buildCoverLetterTask(profile, { jobTitle: input.jobTitle, company: input.company, keyPoints: input.keyPoints, matched, forbidden, tone: input.tone, locale: input.locale }) as unknown as Built;
      return { task, toOutput: (v, violations) => ({ kind: "cover_letter", letter: withSignature(v.letter!, profile.personal.fullName, input.locale), matched, missingRequired: km.missingRequired.map((k) => k.term).filter((t) => isSkillLikeTerm(t, jd)), violations, sourceFieldIds: allIds }) };
    }
  }
}

/**
 * Run one AI job. Blocking fact violations (invented numbers/skills, or JD skills the user lacks) trigger ONE corrective
 * retry; if the model still invents facts the job fails with `unverified_facts` — invented content is never returned.
 */
export async function runAiJob(input: AiJobInput, profile: MasterProfile | null, provider: AiProvider, cfg: RouteConfig, ctx: { cloudConsent: boolean }): Promise<AiRunResult> {
  if (input.kind === "import_extract") {
    const t = buildImportTask(input.text);
    const r = await routeGenerate(provider, cfg, ctx, { messages: t.messages, schema: t.schema as never, jsonSchema: t.jsonSchema, temperature: 0, maxTokens: 6000, timeoutMs: 180_000 });
    const imp = extractedToProfile(r.value as never, input.text);
    if (!String((imp.profile.personal as { fullName?: string }).fullName ?? "").trim() && !imp.counts.experience && !imp.counts.education) throw new AiError("invalid_output", "nothing_found", false);
    return { output: { kind: "imported_profile", profile: imp.profile, counts: imp.counts, dropped: imp.dropped }, provider: r.provider, model: r.model, promptTokens: r.promptTokens, completionTokens: r.completionTokens, durationMs: r.durationMs, attempts: r.attempts };
  }
  if (!profile) throw new AiError("invalid_output", "profile_required", false);
  const { task, toOutput } = plan(input, profile);
  let messages = task.messages;
  let totals = { promptTokens: 0, completionTokens: 0, durationMs: 0, attempts: 0 };
  for (let round = 0; round < 2; round++) {
    const r = await routeGenerate(provider, cfg, ctx, { messages, schema: task.schema as never, jsonSchema: task.jsonSchema, temperature: round ? 0.1 : 0.3, timeoutMs: 180_000 });
    totals = { promptTokens: totals.promptTokens + r.promptTokens, completionTokens: totals.completionTokens + r.completionTokens, durationMs: totals.durationMs + r.durationMs, attempts: totals.attempts + r.attempts };
    const check = task.check(r.value);
    if (check.ok) return { output: toOutput(r.value as Value, check.violations), provider: r.provider, model: r.model, ...totals };
    messages = [...task.messages,
      { role: "assistant", content: JSON.stringify(r.value) },
      { role: "user", content: `Your answer introduced facts that are not in SOURCE: ${describe(check.violations)}. Rewrite it using ONLY facts from SOURCE. Reply with JSON only.` }];
  }
  throw new AiError("invalid_output", "unverified_facts", false);
}
