/**
 * Phase 10C visual regression: page-1 screenshots (print media, bundled fonts, JS off) vs committed baselines.
 * Run: PDF_IT=1 pnpm vitest run services/document-worker/src/visual.test.ts
 * Update baselines intentionally: UPDATE_SNAPSHOTS=1 PDF_IT=1 pnpm vitest run services/document-worker/src/visual.test.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { ResumeDocument } from "@gars/resume-schema";
import { renderResumeHtml, TEMPLATES, getTemplate, type TemplateSpec } from "@gars/template-engine";
import { closeBrowser, renderPng } from "./pdf";

const enabled = process.env.PDF_IT === "1";
const update = process.env.UPDATE_SNAPSHOTS === "1";
const SNAP_DIR = resolve(__dirname, "../../../tests/visual/__snapshots__");
const DIFF_DIR = resolve(__dirname, "../../../tests/visual/__diff__");
/** Per-pixel colour threshold and the share of pixels allowed to differ (antialiasing noise). */
const PIXEL_THRESHOLD = 0.1;
const MAX_DIFF_RATIO = 0.002;

export function comparePng(a: Buffer, b: Buffer): { ratio: number; diff: PNG | null; sizeMismatch: boolean } {
  const A = PNG.sync.read(a);
  const B = PNG.sync.read(b);
  if (A.width !== B.width || A.height !== B.height) return { ratio: 1, diff: null, sizeMismatch: true };
  const diff = new PNG({ width: A.width, height: A.height });
  const n = pixelmatch(A.data, B.data, diff.data, A.width, A.height, { threshold: PIXEL_THRESHOLD });
  return { ratio: n / (A.width * A.height), diff, sizeMismatch: false };
}

function matchSnapshot(name: string, png: Buffer): { created: boolean; ratio: number } {
  const file = resolve(SNAP_DIR, `${name}.png`);
  if (update || !existsSync(file)) {
    mkdirSync(SNAP_DIR, { recursive: true });
    writeFileSync(file, png);
    return { created: true, ratio: 0 };
  }
  const r = comparePng(readFileSync(file), png);
  if (r.ratio > MAX_DIFF_RATIO && r.diff) {
    mkdirSync(DIFF_DIR, { recursive: true });
    writeFileSync(resolve(DIFF_DIR, `${name}.actual.png`), png);
    writeFileSync(resolve(DIFF_DIR, `${name}.diff.png`), PNG.sync.write(r.diff));
  }
  return { created: false, ratio: r.ratio };
}

const doc = (over: Record<string, unknown> = {}) => ResumeDocument.parse({
  schemaVersion: 1, id: "r1", title: "CV", country: "US", locale: "en", templateId: "ats-minimal-01", pageSize: "Letter",
  sectionOrder: ["summary", "experience", "education", "skills", "certifications", "languages"],
  profile: {
    schemaVersion: 1,
    personal: { fullName: "Ayesha Khan", professionalTitle: "Senior Software Engineer", email: "ayesha@example.com", phone: "+966 55 123 4567",
      location: { city: "Riyadh" }, linkedin: "https://linkedin.com/in/ayesha" },
    summary: "Software engineer with five years of experience building scalable web and mobile products in React, Node.js and AWS.",
    experience: [
      { id: "w1", employer: "Tech Solutions Co.", title: "Senior Software Engineer", location: "Riyadh", dates: { start: "2021-01", current: true },
        bullets: [{ id: "b1", text: "Led a team of 4 developers on client projects" }, { id: "b2", text: "Improved application performance by 40%" }, { id: "b3", text: "Introduced automated testing and CI/CD pipelines" }] },
      { id: "w2", employer: "Startup Co", title: "Software Engineer", dates: { start: "2018-06", end: "2020-12" },
        bullets: [{ id: "b4", text: "Built React front-end features used by 20,000 customers" }, { id: "b5", text: "Implemented REST APIs in Node.js" }] },
    ],
    education: [{ id: "e1", institution: "King Saud University", qualification: "B.Sc. Computer Science", dates: { start: "2014", end: "2018" } }],
    skills: ["React", "Node.js", "TypeScript", "AWS", "Docker", "SQL"].map((name, i) => ({ id: `s${i}`, name })),
    certifications: [{ id: "c1", name: "AWS Certified Developer", issuer: "Amazon Web Services", issued: "2022-05" }],
    languages: [{ id: "l1", language: "Arabic", proficiency: "native" }, { id: "l2", language: "English", proficiency: "C1" }],
  },
  ...over,
});

afterAll(async () => { if (enabled) await closeBrowser(); });

describe.skipIf(!enabled)("visual regression", () => {
  it("comparator detects real changes and ignores identical renders", async () => {
    const t = TEMPLATES[0]!;
    const a = await renderPng(renderResumeHtml(doc(), t), { pageSize: "Letter" });
    const same = await renderPng(renderResumeHtml(doc(), t), { pageSize: "Letter" });
    expect(comparePng(a, same).ratio).toBeLessThanOrEqual(MAX_DIFF_RATIO); // deterministic rendering
    const changed: TemplateSpec = { ...t, accent: "#7A1F2B", layout: { ...t.layout, headingStyle: "block" } };
    expect(comparePng(a, await renderPng(renderResumeHtml(doc(), changed), { pageSize: "Letter" })).ratio).toBeGreaterThan(MAX_DIFF_RATIO);
  }, 30_000);

  it.each(TEMPLATES.map((t) => [t.id] as const))("%s matches baseline", async (id) => {
    const png = await renderPng(renderResumeHtml(doc({ templateId: id }), getTemplate(id)!), { pageSize: "Letter" });
    const r = matchSnapshot(`en-${id}`, png);
    expect(r.ratio, `diff written to tests/visual/__diff__/en-${id}.diff.png`).toBeLessThanOrEqual(MAX_DIFF_RATIO);
  }, 30_000);

  it.each([
    ["ar", "SA", "corporate-01"], ["ar", "SA", "modern-01"], ["ur", "PK", "ats-minimal-01"],
    ["ja", "JP", "classic-01"], ["hi", "IN", "ats-minimal-01"], ["zh", "SG", "international-01"],
  ])("%s / %s / %s matches baseline", async (locale, country, id) => {
    const png = await renderPng(renderResumeHtml(doc({ locale, country, templateId: id, pageSize: "A4" }), getTemplate(id)!), { pageSize: "A4" });
    const r = matchSnapshot(`${locale}-${id}`, png);
    expect(r.ratio).toBeLessThanOrEqual(MAX_DIFF_RATIO);
  }, 30_000);
});
