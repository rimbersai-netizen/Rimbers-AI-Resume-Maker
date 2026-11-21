/**
 * AI job contract (shared by web + ai-worker) and execution with the factual-traceability gate.
 */
import { z } from "zod";
import type { MasterProfile } from "@gars/resume-schema";
import { SUPPORTED_LOCALES } from "@gars/shared-types";
import { AiError, type AiProvider } from "./provider";
import { routeGenerate, type RouteConfig } from "./router";
import { buildRewriteBulletsTask, buildSummaryTask, Length, Tone } from "./tasks";
import type { Violation } from "./factcheck";

export const AiJobInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("summary"), masterProfileId: z.string().uuid(), tone: Tone, length: Length, locale: z.enum(SUPPORTED_LOCALES), targetRole: z.string().max(120).optional() }),
  z.object({ kind: z.literal("achievement_bullets"), masterProfileId: z.string().uuid(), experienceId: z.string().min(1).max(64), tone: Tone, locale: z.enum(SUPPORTED_LOCALES) }),
]);
export type AiJobInput = z.infer<typeof AiJobInput>;

export const AiJobOutput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("summary"), summary: z.string(), violations: z.array(z.any()), sourceFieldIds: z.array(z.string()) }),
  z.object({ kind: z.literal("achievement_bullets"), experienceId: z.string(), bullets: z.array(z.string()), violations: z.array(z.any()), sourceFieldIds: z.array(z.string()) }),
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
export async function runAiJob(input: AiJobInput, profile: MasterProfile, provider: AiProvider, cfg: RouteConfig, ctx: { cloudConsent: boolean }): Promise<AiRunResult> {
  const task = input.kind === "summary"
    ? buildSummaryTask(profile, { tone: input.tone, length: input.length, locale: input.locale, targetRole: input.targetRole })
    : buildRewriteBulletsTask(profile, input.experienceId, { tone: input.tone, locale: input.locale });
  const sourceFieldIds = input.kind === "summary"
    ? [...profile.experience.map((w) => w.id), ...profile.education.map((e) => e.id), ...profile.skills.map((s) => s.id)]
    : [input.experienceId];

  let messages = task.messages;
  let totals = { promptTokens: 0, completionTokens: 0, durationMs: 0, attempts: 0 };
  for (let round = 0; round < 2; round++) {
    const r = await routeGenerate(provider, cfg, ctx, { messages, schema: task.schema as never, jsonSchema: task.jsonSchema, temperature: round ? 0.1 : 0.3, timeoutMs: 180_000 });
    totals = { promptTokens: totals.promptTokens + r.promptTokens, completionTokens: totals.completionTokens + r.completionTokens, durationMs: totals.durationMs + r.durationMs, attempts: totals.attempts + r.attempts };
    const check = (task.check as (v: unknown) => { ok: boolean; violations: Violation[] })(r.value);
    if (check.ok) {
      const value = r.value as { summary?: string; bullets?: string[] };
      const output: AiJobOutput = input.kind === "summary"
        ? { kind: "summary", summary: value.summary!, violations: check.violations, sourceFieldIds }
        : { kind: "achievement_bullets", experienceId: input.experienceId, bullets: value.bullets!, violations: check.violations, sourceFieldIds };
      return { output, provider: r.provider, model: r.model, ...totals };
    }
    messages = [...task.messages,
      { role: "assistant", content: JSON.stringify(r.value) },
      { role: "user", content: `Your answer introduced facts that are not in SOURCE: ${describe(check.violations)}. Rewrite it using ONLY facts from SOURCE. Reply with JSON only.` }];
  }
  throw new AiError("invalid_output", "unverified_facts", false);
}
