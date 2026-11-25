import { describe, expect, it } from "vitest";
import { MasterProfile } from "@gars/resume-schema";
import { runAiJob } from "./jobs";
import type { AiProvider } from "./provider";

const profile = MasterProfile.parse({
  schemaVersion: 1, personal: { fullName: "Sara Khan", professionalTitle: "Mobile Developer" },
  experience: [{ id: "w1", employer: "Acme Labs", title: "Flutter Developer", dates: { start: "2021-03", current: true },
    bullets: [{ id: "b1", text: "Built the checkout flow for the mobile app" }, { id: "b2", text: "Led a team of 4 developers" }] }],
  skills: [{ id: "s1", name: "Flutter" }, { id: "s2", name: "Dart" }],
});

const q = (talkingPoints: string[]) => ({ question: "Tell me about a project you are proud of.", category: "behavioral", tip: "Use situation, task, action, result.", talkingPoints });
const answer = (talkingPoints: string[]) => ({ questions: [q(talkingPoints), q([]), q([]), q([])] });

const provider = (answers: unknown[]): AiProvider => {
  let i = 0;
  return {
    name: "mock", isLocal: true,
    health: async () => ({ ok: true, provider: "mock", models: ["m"] }),
    generate: async (model: string, req: any) => ({ value: req.schema.parse(answers[Math.min(i++, answers.length - 1)]), provider: "mock", model, promptTokens: 1, completionTokens: 1, durationMs: 1 }),
  } as unknown as AiProvider;
};
const cfg = { localModels: ["m"], maxAttempts: 1, backoffMs: 0 } as never;
const input = { kind: "interview_prep" as const, masterProfileId: "00000000-0000-4000-8000-000000000001", locale: "en" as const, jobTitle: "Flutter Developer", count: 8,
  jobDescription: "Flutter Developer. Requirements: Flutter, Dart, Kubernetes, 3+ years of experience building mobile apps." };

describe("interview_prep", () => {
  it("returns questions with talking points grounded in the profile, and lists job skills the user lacks as gaps", async () => {
    const r = await runAiJob(input, profile, provider([answer(["Built the checkout flow at Acme Labs", "Led a team of 4 developers"])]), cfg, { cloudConsent: false });
    expect(r.output.kind).toBe("interview_prep");
    if (r.output.kind !== "interview_prep") return;
    expect(r.output.questions).toHaveLength(4);
    expect(r.output.questions[0]!.talkingPoints).toContain("Built the checkout flow at Acme Labs");
    expect(r.output.gaps).toContain("kubernetes");
  });

  it("retries once, then refuses, when talking points invent numbers or skills the user does not have", async () => {
    const bad = answer(["Reduced load time by 70% using Kubernetes"]);
    await expect(runAiJob(input, profile, provider([bad, bad]), cfg, { cloudConsent: false })).rejects.toThrow("unverified_facts");
  });

  it("accepts a corrected second answer", async () => {
    const r = await runAiJob(input, profile, provider([answer(["Reduced load time by 70% using Kubernetes"]), answer(["Built the checkout flow at Acme Labs"])]), cfg, { cloudConsent: false });
    expect(r.output.kind).toBe("interview_prep");
  });
});
