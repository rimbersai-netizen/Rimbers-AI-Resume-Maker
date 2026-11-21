/**
 * Phase 10C Unicode, overflow and export regression (PDF via Chromium + DOCX).
 * Run: PDF_IT=1 pnpm vitest run services/document-worker/src/unicode.test.ts
 */
import { afterAll, describe, expect, it } from "vitest";
import mammoth from "mammoth";
import { ResumeDocument } from "@gars/resume-schema";
import { TEMPLATE_CATEGORIES, TEMPLATES, renderResumeHtml } from "@gars/template-engine";
import { buildDocx } from "./docx";
import { closeBrowser, measureLayout, renderPdf } from "./pdf";

const enabled = process.env.PDF_IT === "1";

async function pdfText(buf: Buffer): Promise<{ text: string; pages: number }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const d = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: false, isEvalSupported: false }).promise;
  let text = "";
  for (let i = 1; i <= d.numPages; i++) text += " " + (await (await d.getPage(i)).getTextContent()).items.map((x) => ("str" in x ? x.str : "")).join(" ");
  const pages = d.numPages;
  await d.destroy();
  return { text, pages };
}
const N = (s: string) => s.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
const LONG_URL = "https://portfolio.example.com/" + "very-long-path-segment-".repeat(8);

const edge = (over: Record<string, unknown> = {}) => ResumeDocument.parse({
  schemaVersion: 1, id: "r", title: "CV", country: "US", locale: "en", templateId: "ats-minimal-01", pageSize: "Letter",
  sectionOrder: ["summary", "experience", "education", "skills", "projects", "languages"],
  profile: {
    schemaVersion: 1,
    personal: { fullName: "José Núñez-Gündoğan", professionalTitle: "Ingénieur Logiciel", email: "jose.nunez@example.com", phone: "+90 532 000 0000",
      location: { city: "İstanbul" }, portfolio: LONG_URL },
    summary: "Experienced engineer 🚀 working across Nguyễn Văn An's team in Hà Nội, Müller-Straße in München and Ünye. " + "Supercalifragilisticexpialidocious".repeat(4),
    experience: [{ id: "w", employer: "Şirket A.Ş.", title: "Kıdemli Geliştirici", dates: { start: "2020-03", current: true },
      bullets: [{ id: "b1", text: "Reduced latency by 35% — façade naïve coöperate" }, { id: "b2", text: "x".repeat(160) }] }],
    education: [{ id: "e", institution: "Boğaziçi Üniversitesi", qualification: "B.Sc.", dates: { start: "2012", end: "2016" } }],
    skills: Array.from({ length: 60 }, (_, i) => ({ id: `s${i}`, name: i === 0 ? "Kubernetes-Operator-Development-Framework-Integration" : `Skill ${i + 1}` })),
    projects: [{ id: "p", name: "Résumé Builder", url: LONG_URL }],
    languages: [{ id: "l", language: "Türkçe", proficiency: "native" }],
  },
  ...over,
});

afterAll(async () => { if (enabled) await closeBrowser(); });

describe.skipIf(!enabled)("Unicode + overflow + export regression", () => {
  it("diacritics and combining marks survive PDF and DOCX text extraction", async () => {
    const d = edge();
    // NFD input (combining acute) must still extract as the same text
    d.profile.personal.fullName = "José Núñez-Gündoğan";
    const html = renderResumeHtml(d, TEMPLATES[0]!);
    const pdf = await pdfText(await renderPdf(html, { pageSize: "Letter" }));
    const { value: docx } = await mammoth.extractRawText({ buffer: await buildDocx(d, TEMPLATES[0]!) });
    for (const w of ["José", "Núñez-Gündoğan", "Nguyễn", "Hà Nội", "Müller-Straße", "İstanbul", "Şirket", "Boğaziçi", "Türkçe", "façade", "naïve"]) {
      expect(N(pdf.text), `PDF: ${w}`).toContain(N(w));
      expect(N(docx), `DOCX: ${w}`).toContain(N(w));
    }
  }, 30_000);

  it("emoji does not break rendering; surrounding text intact", async () => {
    const pdf = await pdfText(await renderPdf(renderResumeHtml(edge(), TEMPLATES[0]!), { pageSize: "Letter" }));
    expect(N(pdf.text)).toContain(N("Experienced engineer"));
    expect(N(pdf.text)).toContain(N("working across"));
  }, 30_000);

  it("mixed bidi: English terms and numbers inside an Arabic resume are extractable", async () => {
    const d = edge({ locale: "ar", country: "SA", pageSize: "A4" });
    d.profile.summary = "مهندس برمجيات بخبرة في React و Node.js منذ 2021 في الرياض.";
    const pdf = await pdfText(await renderPdf(renderResumeHtml(d, TEMPLATES[0]!), { pageSize: "A4" }));
    for (const w of ["React", "Node.js", "2021"]) expect(pdf.text).toContain(w);
  }, 30_000);

  it.each(TEMPLATE_CATEGORIES.map((c) => [c, TEMPLATES.find((t) => t.category === c)!] as const))(
    "%s: long URLs/words wrap (no horizontal overflow), 60 skills paginate, PDF + DOCX export", async (_c, t) => {
      const d = edge({ templateId: t.id });
      const html = renderResumeHtml(d, t);
      const layout = await measureLayout(html, "Letter");
      expect(layout.overflowX, `${t.id} overflows: ${layout.overflowing.join(", ")}`).toBe(0);
      const pdf = await pdfText(await renderPdf(html, { pageSize: "Letter" }));
      expect(pdf.pages).toBeGreaterThanOrEqual(1);
      expect(N(pdf.text)).toContain(N("Skill 60")); // last of 60 skills not lost
      expect(N(pdf.text)).toContain(N("very-long-path-segment-very-long-path-segment"));
      const { value } = await mammoth.extractRawText({ buffer: await buildDocx(d, t) });
      expect(N(value)).toContain(N("Skill 60"));
    }, 30_000);
});
