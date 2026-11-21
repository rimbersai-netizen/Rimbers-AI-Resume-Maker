import { describe, expect, it } from "vitest";
import { MasterProfile } from "@gars/resume-schema";
import { analyzeResume, compareAnalyses, DISCLAIMER, extractKeywords, matchKeywords, stem, tokenize } from "./index";

const strong = MasterProfile.parse({
  schemaVersion: 1,
  personal: { fullName: "Ayesha Khan", professionalTitle: "Software Engineer", email: "ayesha@example.com", phone: "+966 55 123 4567",
    location: { city: "Riyadh", country: "SA" }, linkedin: "https://linkedin.com/in/ayesha" },
  summary: "Software engineer with five years building web and mobile products in React, Node.js and AWS, focused on performance and reliable delivery.",
  experience: [
    { id: "w2", employer: "Tech Solutions", title: "Senior Software Engineer", dates: { start: "2021-01", current: true },
      bullets: [{ id: "b1", text: "Led a team of 4 developers on client projects" }, { id: "b2", text: "Improved application performance by 40%" }, { id: "b3", text: "Built CI/CD pipelines with Docker" }] },
    { id: "w1", employer: "Startup Co", title: "Software Engineer", dates: { start: "2018-06", end: "2020-12" },
      bullets: [{ id: "b4", text: "Developed React front-end features" }, { id: "b5", text: "Implemented REST API endpoints in Node.js" }] },
  ],
  education: [{ id: "e1", institution: "King Saud University", qualification: "B.Sc. Computer Science", dates: { start: "2014", end: "2018" } }],
  skills: ["React", "Node.js", "TypeScript", "AWS", "Docker", "SQL"].map((name, i) => ({ id: `s${i}`, name })),
});

const weak = MasterProfile.parse({ schemaVersion: 1, personal: { fullName: "Sam" } });

const JD = `Senior Software Engineer
We are looking for an engineer to build scalable web apps.
Requirements:
- 4+ years with React and Node.js
- Experience with Kubernetes and AWS
Nice to have:
- GraphQL
- TypeScript`;

describe("tokenize/keywords", () => {
  it("keeps tech tokens and normalises synonyms", () => {
    const t = tokenize("JS, Node.js, C++, C#, k8s and CI/CD; postgres");
    expect(t).toEqual(expect.arrayContaining(["javascript", "node.js", "c++", "c#", "kubernetes", "ci/cd", "postgresql"]));
  });
  it("numeric tokens (5+, 40%, 3.5) are not keywords", () => {
    expect(extractKeywords("Requirements:\n- 5+ years with React\n- 40% travel\n- GPA 3.5").map((k) => k.term)).not.toEqual(expect.arrayContaining(["5+"]));
    expect(tokenize("5+ years 40% 3.5 C++")).toEqual(expect.arrayContaining(["c++"]));
    expect(tokenize("5+ years 40% 3.5")).not.toContain("5+");
  });
  it("handles non-Latin text without crashing", () => expect(tokenize("مهندس برمجيات React")).toContain("react"));
  it("marks requirement-section terms as required, nice-to-have as optional", () => {
    const k = extractKeywords(JD);
    expect(k.find((x) => x.term === "kubernetes")?.required).toBe(true);
    expect(k.find((x) => x.term === "react")?.required).toBe(true);
    expect(k.find((x) => x.term === "graphql")?.required).toBe(false);
  });
  it("matches and lists missing required terms", () => {
    const m = matchKeywords(extractKeywords(JD), "React Node.js AWS TypeScript");
    expect(m.missingRequired.map((x) => x.term)).toContain("kubernetes");
    expect(m.matched.map((x) => x.term)).toEqual(expect.arrayContaining(["react", "node.js", "aws"]));
    expect(m.score).toBeGreaterThan(0);
    expect(m.score).toBeLessThan(100);
  });
});

describe("word-form matching", () => {
  it("matches supervise/supervised, coordination/coordinated, projects/project; tech tokens exact", () => {
    const m = matchKeywords(extractKeywords("Requirements:\n- Supervise projects\n- Coordination of teams\n- Node.js"), "Supervised a project. Coordinated teams. Node.js");
    expect(m.missing.map((k) => k.term)).toEqual([]);
    expect(stem("node.js")).toBe("node.js");
    expect(stem("engineer")).toBe("engineer");
  });
});

describe("analyzeResume", () => {
  it("is deterministic", () => expect(analyzeResume({ profile: strong, jobDescription: JD })).toEqual(analyzeResume({ profile: strong, jobDescription: JD })));

  it("rates a complete resume above an empty one", () => {
    const a = analyzeResume({ profile: strong });
    const b = analyzeResume({ profile: weak });
    expect(a.overall).toBeGreaterThan(b.overall);
    expect(a.overall).toBeGreaterThanOrEqual(70);
    expect(b.band).toBe("needs_work");
  });

  it("every non-perfect category explains itself", () => {
    for (const c of analyzeResume({ profile: weak }).categories) if (c.score < 100) expect(c.findings.length).toBeGreaterThan(0);
  });

  it("always includes the no-guarantee disclaimer and no guarantee language", () => {
    const r = analyzeResume({ profile: strong, jobDescription: JD });
    expect(r.disclaimer).toBe(DISCLAIMER);
    const text = JSON.stringify({ ...r, disclaimer: "" }).toLowerCase();
    expect(text).not.toMatch(/guaranteed to pass|will pass|100% ats/);
  });

  it("flags missing required JD skills and warns not to fabricate", () => {
    const m = analyzeResume({ profile: strong, jobDescription: JD }).categories.find((c) => c.id === "job_match")!;
    const f = m.findings.find((x) => x.id === "match.missing_required")!;
    expect(f.message).toContain("kubernetes");
    expect(f.suggestion).toMatch(/only if you genuinely/i);
  });

  it("no-metrics suggestion never invents numbers", () => {
    const p = MasterProfile.parse({ ...strong, experience: [{ id: "x", employer: "A", title: "B", dates: { start: "2020" },
      bullets: [{ id: "1", text: "Managed accounts" }, { id: "2", text: "Prepared reports" }, { id: "3", text: "Supported clients" }] }] });
    const f = analyzeResume({ profile: p }).categories.find((c) => c.id === "experience")!.findings.find((x) => x.id === "exp.no_metrics")!;
    expect(f.suggestion).toMatch(/do not estimate/i);
  });

  it("penalises parse-unfriendly templates and failed text extraction", () => {
    const safe = analyzeResume({ profile: strong, template: { columns: 1, usesTables: false, usesIconsForText: false, usesGraphicsForSkills: false, headingsAreText: true } });
    const risky = analyzeResume({ profile: strong, template: { columns: 2, usesTables: true, usesIconsForText: true, usesGraphicsForSkills: true, headingsAreText: true } });
    expect(safe.categories.find((c) => c.id === "formatting")!.score).toBe(100);
    expect(risky.categories.find((c) => c.id === "formatting")!.score).toBeLessThan(50);
    const broken = analyzeResume({ profile: strong, extractedText: "" });
    expect(broken.categories.find((c) => c.id === "formatting")!.findings.some((f) => f.id === "fmt.extraction_failed")).toBe(true);
  });

  it("detects non reverse-chronological order", () => {
    const p = MasterProfile.parse({ ...strong, experience: [...strong.experience].reverse() });
    expect(analyzeResume({ profile: p }).categories.find((c) => c.id === "experience")!.findings.some((f) => f.id === "exp.not_reverse_chrono")).toBe(true);
  });

  it("hidden items are excluded", () => {
    const r = analyzeResume({ profile: strong, hiddenItemIds: ["w1", "w2"] });
    expect(r.categories.find((c) => c.id === "completeness")!.findings.some((f) => f.id === "complete.experience_missing")).toBe(true);
  });

  it("before/after comparison reports resolved findings", () => {
    const before = analyzeResume({ profile: MasterProfile.parse({ ...strong, summary: undefined }) });
    const after = analyzeResume({ profile: strong });
    const cmp = compareAnalyses(before, after);
    expect(cmp.overallDelta).toBeGreaterThan(0);
    expect(cmp.resolvedFindings).toContain("complete.summary_missing");
  });
});
