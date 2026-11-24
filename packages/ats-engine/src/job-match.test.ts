import { describe, expect, it } from "vitest";
import { MasterProfile } from "@gars/resume-schema";
import { detectSkills, jobSkills, profileYears, requiredYears, scoreJob, tailorPlan } from "./index";

const NOW = new Date("2026-11-24T00:00:00Z");
const dev = MasterProfile.parse({
  schemaVersion: 1,
  personal: { fullName: "Ayesha Khan", professionalTitle: "Software Engineer" },
  summary: "Engineer building web products.",
  experience: [
    { id: "w2", employer: "Tech Solutions", title: "Senior Software Engineer", dates: { start: "2021-01", current: true },
      bullets: [{ id: "b1", text: "Built CI/CD pipelines with Docker" }, { id: "b2", text: "Designed GraphQL APIs" }] },
    { id: "w1", employer: "Startup Co", title: "Software Engineer", dates: { start: "2018-06", end: "2020-12" }, bullets: [{ id: "b4", text: "Developed React front-end features" }] },
  ],
  skills: ["React", "Node.js", "TypeScript", "AWS"].map((name, i) => ({ id: `s${i}`, name })),
});
const nobody = MasterProfile.parse({ schemaVersion: 1, personal: { fullName: "Sam" } });

const JOB = {
  title: "Software Engineer, Product",
  tags: ["react", "typescript"],
  description: "Build the product. Requirements: 4+ years of experience with React, TypeScript, Node.js and PostgreSQL. Kubernetes a plus.",
};

describe("skill detection", () => {
  it("canonicalises aliases and punctuation-heavy names", () => {
    const s = detectSkills("We use JS, k8s, Postgres, Node, C++, C# and CI/CD. React Native too.");
    for (const k of ["javascript", "kubernetes", "postgresql", "node.js", "c++", "c#", "ci/cd", "react-native"]) expect(s.has(k), k).toBe(true);
  });
  it("does not match inside other words", () => {
    expect(detectSkills("Our goal is to go further in rusty marketplaces").size).toBe(0);
  });
});

describe("requirements", () => {
  it("reads the lowest stated years bar", () => {
    expect(requiredYears("3-5 years of experience")).toBe(3);
    expect(requiredYears("4+ yrs")).toBe(4);
    expect(requiredYears("no years mentioned")).toBeUndefined();
  });
  it("counts overlapping jobs once", () => {
    const p = MasterProfile.parse({ schemaVersion: 1, personal: { fullName: "X" }, experience: [
      { id: "a", employer: "A", title: "T", dates: { start: "2020-01", end: "2022-01" }, bullets: [] },
      { id: "b", employer: "B", title: "T", dates: { start: "2021-01", end: "2023-01" }, bullets: [] }] });
    expect(profileYears(p, NOW)).toBe(3);
  });
  it("flags title and requirements-section skills as required", () => {
    const r = jobSkills(JOB);
    expect(r.find((s) => s.skill === "react")?.required).toBe(true);
    expect(r.find((s) => s.skill === "postgresql")?.required).toBe(true);
  });
});

describe("scoreJob", () => {
  it("rates a relevant profile well above an empty one, deterministically", () => {
    const a = scoreJob(dev, JOB, NOW);
    expect(a.score).toBeGreaterThanOrEqual(60);
    expect(scoreJob(nobody, JOB, NOW).score).toBeLessThan(25);
    expect(scoreJob(dev, JOB, NOW)).toEqual(a);
  });
  it("lists exactly the skills the profile lacks", () => {
    const m = scoreJob(dev, JOB, NOW);
    expect(m.matched.map((s) => s.skill)).toEqual(expect.arrayContaining(["react", "typescript", "node.js"]));
    expect(m.missing.map((s) => s.skill)).toEqual(expect.arrayContaining(["postgresql", "kubernetes"]));
    expect(m.missing.map((s) => s.skill)).not.toContain("react");
  });
  it("penalises unmet years of experience", () => {
    const junior = MasterProfile.parse({ ...dev, experience: [{ ...dev.experience[1]!, dates: { start: "2025-06", end: "2026-06" } }] });
    expect(scoreJob(junior, JOB, NOW).parts.seniority).toBeLessThan(0.5);
  });
  it("never reports 'strong' for a posting with no recognisable skills", () => {
    const m = scoreJob(dev, { title: "Office helper", description: "Help around the office and keep things tidy every day." }, NOW);
    expect(m.score).toBeLessThan(75);
  });
});

describe("tailorPlan", () => {
  it("separates what is listed, what is only in experience text, and true gaps", () => {
    const t = tailorPlan(dev, { title: "Platform Engineer", description: "Requirements: React, Docker, GraphQL, Kubernetes, Rust." });
    expect(t.strengths.map((s) => s.skill)).toEqual(["react"]);
    expect(t.optimizations.map((s) => s.skill).sort()).toEqual(["docker", "graphql"]);
    expect(t.gaps.map((s) => s.skill).sort()).toEqual(["kubernetes", "rust"]);
  });
});
