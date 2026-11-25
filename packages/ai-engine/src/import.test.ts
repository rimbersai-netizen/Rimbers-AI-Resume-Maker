import { describe, expect, it } from "vitest";
import { MasterProfile } from "@gars/resume-schema";
import { extractedToProfile, grounded, ImportExtract, normDate } from "./import";
import { runAiJob } from "./jobs";
import type { AiProvider } from "./provider";

const CV = `Sara Khan
Software Engineer
sara.khan@example.com | +92 300 1234567 | linkedin.com/in/sara-khan
Islamabad, Pakistan

SUMMARY
Engineer with 6 years of experience building mobile apps.

EXPERIENCE
Senior Flutter Developer, Acme Labs  Mar 2021 - Present
- Built the checkout flow used by 40000 customers
- Led a team of 4 developers
Flutter Developer, Bright Studio  06/2018 - 02/2021
- Shipped 5 apps to the Play Store

EDUCATION
BS Computer Science, FAST University  2014 - 2018

SKILLS
Flutter, Dart, Firebase, REST APIs

LANGUAGES
English (C1), Urdu (native)`;

const modelAnswer = {
  personal: { fullName: "Sara Khan", professionalTitle: "Software Engineer", email: "sara.khan@example.com", phone: "+92 300 1234567", city: "Islamabad", countryCode: "PK", linkedin: "linkedin.com/in/sara-khan", website: "https://invented.example.com" },
  summary: "Engineer with 6 years of experience building mobile apps.",
  experience: [
    { employer: "Acme Labs", title: "Senior Flutter Developer", start: "Mar 2021", end: "Present", bullets: ["Built the checkout flow used by 40000 customers", "Led a team of 4 developers", "Won an award from Google for innovation"] },
    { employer: "Bright Studio", title: "Flutter Developer", start: "06/2018", end: "02/2021", bullets: ["Shipped 5 apps to the Play Store"] },
    { employer: "Globex Corporation", title: "CTO", start: "2010", end: "2012", bullets: ["Ran everything"] },
  ],
  education: [{ institution: "FAST University", qualification: "BS Computer Science", start: "2014", end: "2018" }],
  skills: ["Flutter", "Dart", "Firebase", "REST APIs", "Kubernetes"],
  languages: [{ language: "English", proficiency: "C1" }, { language: "Urdu", proficiency: "native" }],
};

describe("resume import grounding", () => {
  const out = extractedToProfile(ImportExtract.parse(modelAnswer), CV);
  const p = out.profile as Record<string, any>;

  it("keeps everything that is in the document and produces a valid master profile", () => {
    expect(p.personal.fullName).toBe("Sara Khan");
    expect(p.personal.email).toBe("sara.khan@example.com");
    expect(p.experience.map((w: any) => w.employer)).toEqual(["Acme Labs", "Bright Studio"]);
    expect(p.experience[0].dates).toEqual({ start: "2021-03", end: undefined, current: true });
    expect(p.experience[1].dates).toEqual({ start: "2018-06", end: "2021-02", current: false });
    expect(MasterProfile.safeParse(p).success).toBe(true);
  });

  it("drops invented employers, bullets, skills and links", () => {
    expect(JSON.stringify(p)).not.toMatch(/Globex|award from Google|Kubernetes|invented\.example/);
    expect(p.skills.map((s: any) => s.name)).toEqual(["Flutter", "Dart", "Firebase", "REST APIs"]);
    expect(p.experience[0].bullets).toHaveLength(2);
    expect(out.dropped).toBeGreaterThanOrEqual(4);
  });

  it("maps languages and counts", () => {
    expect(p.languages).toMatchObject([{ language: "English", proficiency: "C1" }, { language: "Urdu", proficiency: "native" }]);
    expect(out.counts).toMatchObject({ experience: 2, education: 1, skills: 4 });
  });
});

describe("helpers", () => {
  it("normalises dates", () => {
    expect([normDate("Mar 2020"), normDate("03/2020"), normDate("2020-03-15"), normDate("2020"), normDate("soon")]).toEqual(["2020-03", "2020-03", "2020-03", "2020", undefined]);
  });
  it("grounded() ignores case and punctuation", () => {
    expect(grounded("node.js", "we use node js daily")).toBe(true);
    expect(grounded("Rust", "we use node js daily")).toBe(false);
  });
});

describe("runAiJob import_extract", () => {
  const provider = (answer: unknown): AiProvider => ({
    name: "mock", isLocal: true,
    health: async () => ({ ok: true, provider: "mock", models: ["m"] }),
    generate: async (model: string, req: any) => ({ value: req.schema.parse(answer), provider: "mock", model, promptTokens: 1, completionTokens: 1, durationMs: 1 }),
  } as unknown as AiProvider);
  const cfg = { localModels: ["m"], maxAttempts: 1, backoffMs: 0 } as never;

  it("needs no profile and returns the grounded draft", async () => {
    const r = await runAiJob({ kind: "import_extract", locale: "en", text: CV }, null, provider(modelAnswer), cfg, { cloudConsent: false });
    expect(r.output.kind).toBe("imported_profile");
    if (r.output.kind === "imported_profile") expect(r.output.counts.experience).toBe(2);
  });

  it("fails with nothing_found when the model finds nothing in the text", async () => {
    await expect(runAiJob({ kind: "import_extract", locale: "en", text: CV }, null, provider({ personal: {} }), cfg, { cloudConsent: false })).rejects.toThrow("nothing_found");
  });
});

describe("names", () => {
  it("title-cases a shouted name only", async () => {
    const { titleCaseIfShouting } = await import("./import");
    expect([titleCaseIfShouting("MARIA GONZALEZ"), titleCaseIfShouting("Anne-Marie O'NEIL"), titleCaseIfShouting("Sara Khan"), titleCaseIfShouting("ANNE-MARIE")]).toEqual(["Maria Gonzalez", "Anne-Marie O'NEIL", "Sara Khan", "Anne-Marie"]);
  });
});
