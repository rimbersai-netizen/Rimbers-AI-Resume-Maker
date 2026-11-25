/** Real Gemini interview prep through runAiJob (fact gate included). Synthetic profile. GEMINI_LIVE=1 + GEMINI_API_KEY. */
import { describe, expect, it } from "vitest";
import { MasterProfile } from "@gars/resume-schema";
import { GeminiProvider, OllamaProvider, runAiJob, type RouteConfig } from "./index";

const live = process.env.GEMINI_LIVE === "1" && Boolean(process.env.GEMINI_API_KEY);
const profile = MasterProfile.parse({ schemaVersion: 1, personal: { fullName: "Sara Khan", professionalTitle: "Mobile Developer" },
  experience: [{ id: "w1", employer: "Acme Labs", title: "Flutter Developer", dates: { start: "2021-03", current: true },
    bullets: [{ id: "b1", text: "Built the checkout flow for the mobile app" }, { id: "b2", text: "Led a team of 4 developers" }] }],
  skills: [{ id: "s1", name: "Flutter" }, { id: "s2", name: "Dart" }, { id: "s3", name: "Firebase" }] });

describe.skipIf(!live)("interview_prep live", () => {
  it("returns grounded questions", async () => {
    const route: RouteConfig = { localModels: ["qwen3:4b"], maxAttempts: 2, backoffMs: 1500,
      cloud: { provider: new GeminiProvider({ apiKey: process.env.GEMINI_API_KEY!, fallbackModels: ["gemini-3.1-flash-lite", "gemini-3.7-flash"] }), model: "gemini-3.5-flash-lite", enabled: true, first: true, assumeConsent: true } };
    const r = await runAiJob({ kind: "interview_prep", masterProfileId: "00000000-0000-4000-8000-000000000001", locale: "en", jobTitle: "Senior Flutter Developer", company: "Globex", count: 8,
      jobDescription: "Senior Flutter Developer. Requirements: Flutter, Dart, Kubernetes, CI/CD pipelines, 5+ years of experience in mobile apps, mentoring junior developers." },
      profile, new OllamaProvider({ baseUrl: "http://127.0.0.1:1" }), route, { cloudConsent: true });
    if (r.output.kind !== "interview_prep") throw new Error("wrong kind");
    console.log(JSON.stringify({ model: r.model, gaps: r.output.gaps, violations: r.output.violations, sample: r.output.questions.slice(0, 3) }, null, 1));
    expect(r.output.questions.length).toBeGreaterThanOrEqual(4);
    expect(r.output.questions.every((q) => q.question.length > 8)).toBe(true);
    expect(JSON.stringify(r.output.questions.flatMap((q) => q.talkingPoints))).not.toMatch(/kubernetes/i);
  }, 120_000);
});
