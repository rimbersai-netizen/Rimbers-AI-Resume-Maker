import { vi } from "vitest";
vi.mock("server-only", () => ({}));
import { describe, expect, it } from "vitest";
import { MasterProfile } from "@gars/resume-schema";
import { scoreJob } from "@gars/ats-engine";
import { loadAllJobs, passesPrefs, PrefsSchema } from "./jobs";

/** Real public job feeds (Remotive + Arbeitnow). Run with JOBS_LIVE=1 pnpm vitest run apps/web/src/lib/services/jobs.live.test.ts */
const live = process.env.JOBS_LIVE === "1" ? describe : describe.skip;

const profile = MasterProfile.parse({
  schemaVersion: 1,
  personal: { fullName: "Test Person", professionalTitle: "Software Engineer" },
  experience: [{ id: "w1", employer: "Co", title: "Software Engineer", dates: { start: "2019-01", current: true }, bullets: [{ id: "b1", text: "Built React and Node.js apps on AWS with PostgreSQL" }] }],
  skills: ["React", "TypeScript", "Node.js", "AWS", "PostgreSQL"].map((name, i) => ({ id: `s${i}`, name })),
});

live("live job feeds", () => {
  it("loads, cleans and scores real listings", async () => {
    const { jobs, degraded } = await loadAllJobs();
    console.log(`jobs=${jobs.length} degraded=${degraded.join(",") || "none"} sources=${[...new Set(jobs.map((j) => j.source))].join(",")}`);
    expect(jobs.length).toBeGreaterThan(20);
    for (const j of jobs.slice(0, 50)) {
      expect(j.url).toMatch(/^https?:\/\//);
      expect(j.description).not.toMatch(/<\/?[a-z][^>]*>/i); // HTML fully stripped
    }
    const eng = jobs.filter((j) => passesPrefs(j, PrefsSchema.parse({ roles: ["engineer"], postedWithinDays: 30 })));
    const scored = eng.map((j) => ({ j, m: scoreJob(profile, j) })).sort((a, b) => b.m.score - a.m.score);
    console.log(`engineer jobs=${eng.length}`);
    for (const { j, m } of scored.slice(0, 5)) console.log(`${m.score} ${m.label} | ${j.title} @ ${j.company} | have=[${m.matched.map((s) => s.label)}] missing=[${m.missing.slice(0, 4).map((s) => s.label)}]`);
    expect(scored.length).toBeGreaterThan(0);
    expect(scored[0]!.m.score).toBeGreaterThan(scored[scored.length - 1]!.m.score - 1);
  }, 90_000);
});
