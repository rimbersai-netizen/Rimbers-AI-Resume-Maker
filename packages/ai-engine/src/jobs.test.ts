import { describe, expect, it } from "vitest";
import { MasterProfile } from "@gars/resume-schema";
import { AiError, AiJobInput, runAiJob, userFacingAiError, type AiProvider, type ChatMessage } from "./index";

const profile = MasterProfile.parse({
  schemaVersion: 1, personal: { fullName: "Omar", professionalTitle: "Site Engineer" }, summary: "Site engineer who supervise residential construction projects.",
  experience: [{ id: "w1", employer: "Al Bina", title: "Site Engineer", dates: { start: "2019-03", current: true },
    bullets: [{ id: "b1", text: "Supervised construction of 3 residential buildings" }, { id: "b2", text: "Coordinated subcontractors" }] }],
  skills: [{ id: "s1", name: "AutoCAD" }],
});

/** Scripted fake model: returns the next answer each call and records the messages it was sent. */
function scripted(answers: unknown[]) {
  const seen: ChatMessage[][] = [];
  const provider: AiProvider = {
    name: "fake", isLocal: true,
    health: async () => ({ ok: true, provider: "fake", models: ["m"] }),
    generate: async (_m, req) => {
      seen.push(req.messages);
      const next = answers.shift();
      const parsed = req.schema.safeParse(next);
      if (!parsed.success) throw new AiError("invalid_output", "bad", true);
      return { value: parsed.data, provider: "fake", model: "m", promptTokens: 10, completionTokens: 5, durationMs: 1 };
    },
  };
  return { provider, seen };
}
const cfg = { localModels: ["m"], sleep: async () => {} };
const summaryInput = AiJobInput.parse({ kind: "summary", masterProfileId: "00000000-0000-4000-8000-000000000001", tone: "professional", length: "short", locale: "en" });

describe("runAiJob fact-check gate", () => {
  it("returns a faithful summary with source ids and usage", async () => {
    const { provider } = scripted([{ summary: "Site Engineer at Al Bina supervising construction of 3 residential buildings with AutoCAD." }]);
    const r = await runAiJob(summaryInput, profile, provider, cfg, { cloudConsent: false });
    expect(r.output.kind).toBe("summary");
    expect(r.output.sourceFieldIds).toContain("w1");
    expect(r.promptTokens).toBe(10);
  });

  it("invented number → one corrective retry naming the problem → faithful answer accepted", async () => {
    const { provider, seen } = scripted([
      { summary: "Site Engineer who supervised 12 buildings and saved 30% of costs at Al Bina." },
      { summary: "Site Engineer at Al Bina who supervised construction of 3 residential buildings." },
    ]);
    const r = await runAiJob(summaryInput, profile, provider, cfg, { cloudConsent: false });
    expect(r.output.kind === "summary" && r.output.summary).toContain("3 residential");
    expect(seen).toHaveLength(2);
    expect(seen[1]!.at(-1)!.content).toMatch(/not in SOURCE: number "12", number "30"/);
    expect(r.promptTokens).toBe(20);
  });

  it("model keeps inventing → job fails with unverified_facts; nothing invented is returned", async () => {
    const { provider } = scripted([
      { summary: "Site Engineer with Kubernetes expertise and 10 years at Al Bina." },
      { summary: "Site Engineer with Kubernetes expertise and 10 years at Al Bina." },
    ]);
    const err = await runAiJob(summaryInput, profile, provider, cfg, { cloudConsent: false }).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(userFacingAiError(err)).toMatchObject({ code: "unverified_facts", canRetry: true });
    expect(userFacingAiError(err).message).toMatch(/aren't in your profile/);
  });

  it("bullet rewrite keeps the experience id and passes faithful rewrites", async () => {
    const { provider } = scripted([{ bullets: ["Supervised construction of 3 residential buildings", "Coordinated subcontractors on site"] }]);
    const input = AiJobInput.parse({ kind: "achievement_bullets", masterProfileId: "00000000-0000-4000-8000-000000000001", experienceId: "w1", tone: "concise", locale: "en" });
    const r = await runAiJob(input, profile, provider, cfg, { cloudConsent: false });
    expect(r.output).toMatchObject({ kind: "achievement_bullets", experienceId: "w1", sourceFieldIds: ["w1"] });
  });

  it("input contract rejects unknown kinds, locales and bad ids", () => {
    expect(AiJobInput.safeParse({ kind: "write_novel" }).success).toBe(false);
    expect(AiJobInput.safeParse({ ...summaryInput, locale: "xx" }).success).toBe(false);
    expect(AiJobInput.safeParse({ ...summaryInput, masterProfileId: "nope" }).success).toBe(false);
  });
});

describe("8B jobs: grammar, tone, tailoring", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  it("grammar fix is checked against the original text and returns a polish output", async () => {
    const { provider, seen } = scripted([{ summary: "Site engineer who supervises residential construction projects." }]);
    const r = await runAiJob(AiJobInput.parse({ kind: "grammar", masterProfileId: id, locale: "en", target: { type: "summary" } }), profile, provider, cfg, { cloudConsent: false });
    expect(r.output).toMatchObject({ kind: "polish", mode: "grammar", summary: "Site engineer who supervises residential construction projects." });
    expect(seen[0]![1]!.content).toContain("Correct grammar");
  });

  it("tone change on bullets may not add numbers", async () => {
    const { provider } = scripted([
      { bullets: ["Oversaw construction of 3 residential buildings", "Coordinated 25 subcontractors"] },
      { bullets: ["Oversaw construction of 3 residential buildings", "Coordinated subcontractors"] },
    ]);
    const r = await runAiJob(AiJobInput.parse({ kind: "tone", masterProfileId: id, locale: "en", tone: "confident", target: { type: "bullets", experienceId: "w1" } }), profile, provider, cfg, { cloudConsent: false });
    expect(r.output.kind === "polish" && r.output.bullets).toEqual(["Oversaw construction of 3 residential buildings", "Coordinated subcontractors"]);
  });

  it("tailoring: matched/missing come from the ATS engine; a JD skill the user lacks is blocked", async () => {
    const jd = "Site Engineer\nRequirements:\n- AutoCAD\n- Revit and BIM coordination\n- Supervise residential construction";
    const { provider, seen } = scripted([
      { summary: "Site Engineer skilled in AutoCAD and Revit supervising residential construction." },
      { summary: "Site Engineer skilled in AutoCAD supervising construction of 3 residential buildings at Al Bina." },
    ]);
    const r = await runAiJob(AiJobInput.parse({ kind: "tailor_resume", masterProfileId: id, locale: "en", tone: "professional", jobDescription: jd }), profile, provider, cfg, { cloudConsent: false });
    expect(r.output.kind).toBe("tailored_summary");
    if (r.output.kind !== "tailored_summary") return;
    expect(r.output.matched).toContain("autocad");
    expect(r.output.missingRequired).toContain("revit");
    expect(r.output.summary).not.toMatch(/revit/i);
    expect(seen[1]!.at(-1)!.content).toMatch(/skill "revit"/);
  });

  it("polish without existing text is rejected before calling the model", async () => {
    const { provider, seen } = scripted([]);
    const empty = MasterProfile.parse({ ...profile, summary: undefined });
    await expect(runAiJob(AiJobInput.parse({ kind: "grammar", masterProfileId: id, locale: "en", target: { type: "summary" } }), empty, provider, cfg, { cloudConsent: false })).rejects.toThrow(/No summary/);
    expect(seen).toHaveLength(0);
  });

  it("tailoring input requires a real job description", () => {
    expect(AiJobInput.safeParse({ kind: "tailor_resume", masterProfileId: id, locale: "en", tone: "professional", jobDescription: "short" }).success).toBe(false);
  });
});
