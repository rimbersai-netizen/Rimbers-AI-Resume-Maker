/** Every AI job kind through runAiJob (fact-check gate included) with Gemini as primary. Synthetic profile only. GEMINI_LIVE=1 + GEMINI_API_KEY. */
import { describe, expect, it } from "vitest";
import { MasterProfile } from "@gars/resume-schema";
import { AiJobInput, GeminiProvider, OllamaProvider, runAiJob, type RouteConfig } from "./index";

const live = process.env.GEMINI_LIVE === "1" && Boolean(process.env.GEMINI_API_KEY);
const profile = MasterProfile.parse({ schemaVersion: 1, personal: { fullName: "Test User", professionalTitle: "Civil Engineer", location: { city: "Riyadh", country: "SA" } },
  summary: "Site engineer with experiance in residential construction.",
  experience: [{ id: "w1", employer: "Al Bina Contracting", title: "Site Engineer", dates: { start: "2019-03", current: true },
    bullets: [{ id: "b1", text: "Supervised construction of 3 residential buildings" }, { id: "b2", text: "Coordinated subcontractors and inspections" }] }],
  skills: [{ id: "s1", name: "AutoCAD" }, { id: "s2", name: "Primavera" }] });

const route: RouteConfig = {
  localModels: ["qwen3:4b"], maxAttempts: 2, backoffMs: 1500,
  cloud: { provider: new GeminiProvider({ apiKey: process.env.GEMINI_API_KEY ?? "x", fallbackModels: ["gemini-flash-lite-latest"] }), model: "gemini-flash-lite-latest", enabled: true, first: true, assumeConsent: true },
};
const base = { masterProfileId: "00000000-0000-4000-8000-000000000001", locale: "en" as const };
const JD = "Site Engineer for residential towers. Requirements: AutoCAD, Primavera, subcontractor coordination, Revit, 3+ years experience.";
const inputs: Record<string, unknown> = {
  summary: { kind: "summary", ...base, tone: "professional", length: "short" },
  achievement_bullets: { kind: "achievement_bullets", ...base, experienceId: "w1", tone: "professional" },
  grammar: { kind: "grammar", ...base, target: { type: "summary" } },
  tone: { kind: "tone", ...base, target: { type: "summary" }, tone: "confident" },
  tailor_resume: { kind: "tailor_resume", ...base, jobDescription: JD, tone: "professional", targetRole: "Site Engineer" },
  cover_letter: { kind: "cover_letter", ...base, tone: "professional", jobTitle: "Site Engineer", company: "Acme", jobDescription: JD },
  linkedin_headline: { kind: "linkedin_headline", ...base, tone: "professional" },
  linkedin_about: { kind: "linkedin_about", ...base, tone: "professional" },
};

describe.skipIf(!live)("Gemini through runAiJob (all kinds)", () => {
  for (const [kind, raw] of Object.entries(inputs)) {
    it(kind, async () => {
      const input = AiJobInput.parse(raw);
      const r = await runAiJob(input, profile, new OllamaProvider(), route, { cloudConsent: false });
      const out = r.output as Record<string, unknown>;
      console.log(`${kind}: provider=${r.provider} model=${r.model} attempts=${r.attempts} violations=${JSON.stringify((out.violations as unknown[]).length)} :: ${JSON.stringify(out).slice(0, 220)}`);
      expect(r.provider).toBe("gemini");
    }, 120_000);
  }
});
