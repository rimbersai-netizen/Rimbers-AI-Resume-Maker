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
import { buildCoverLetterTask, buildPolishTask, buildRewriteBulletsTask, buildSummaryTask, buildTailorSummaryTask, Length, Tone } from "./tasks";
import type { Violation } from "./factcheck";

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
]);
export type AiJobInput = z.infer<typeof AiJobInput>;

const meta = { violations: z.array(z.any()), sourceFieldIds: z.array(z.string()) };
export const AiJobOutput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("summary"), summary: z.string(), ...meta }),
  z.object({ kind: z.literal("achievement_bullets"), experienceId: z.string(), bullets: z.array(z.string()), ...meta }),
  z.object({ kind: z.literal("polish"), mode: z.enum(["grammar", "tone"]), target: Target, summary: z.string().optional(), bullets: z.array(z.string()).optional(), ...meta }),
  /** matched/missingRequired are deterministic (ATS engine), never model-generated. */
  z.object({ kind: z.literal("tailored_summary"), summary: z.string(), matched: z.array(z.string()), missingRequired: z.array(z.string()), ...meta }),
  z.object({ kind: z.literal("cover_letter"), letter: z.string(), matched: z.array(z.string()), missingRequired: z.array(z.string()), ...meta }),
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

type Value = { summary?: string; bullets?: string[]; letter?: string };
function plan(input: AiJobInput, profile: MasterProfile): { task: Built; toOutput: (value: Value, violations: Violation[]) => AiJobOutput } {
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
export async function runAiJob(input: AiJobInput, profile: MasterProfile, provider: AiProvider, cfg: RouteConfig, ctx: { cloudConsent: boolean }): Promise<AiRunResult> {
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
