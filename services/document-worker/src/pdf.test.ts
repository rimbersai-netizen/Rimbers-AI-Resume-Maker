/**
 * Phase 10A/10C PDF tests with real Chromium. Run: PDF_IT=1 pnpm vitest run services/document-worker
 */
import { inflateSync } from "node:zlib";
import { afterAll, describe, expect, it } from "vitest";
import { ResumeDocument } from "@gars/resume-schema";
import { renderResumeHtml, TEMPLATES, RESUME_HEADINGS } from "@gars/template-engine";
import { closeBrowser, renderPdf } from "./pdf";

const enabled = process.env.PDF_IT === "1";

async function readPdf(buf: Buffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: false, isEvalSupported: false }).promise;
  const pages: string[] = [];
  const links: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    pages.push(tc.items.map((x) => ("str" in x ? x.str : "")).join(" ").replace(/\s+/g, " ").trim());
    for (const a of await page.getAnnotations()) if (a.subtype === "Link" && a.url) links.push(a.url as string);
  }
  await doc.destroy();
  return { pages, text: pages.join(" "), links };
}
/** Text supplied via /ActualText marked content (Chromium uses it for shaped glyphs, e.g. Arabic joining forms). */
function actualTexts(buf: Buffer): string[] {
  const raw = buf.toString("latin1");
  const out: string[] = [];
  for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let dec: string;
    try { dec = inflateSync(Buffer.from(m[1]!, "latin1")).toString("latin1"); } catch { continue; }
    for (const a of dec.matchAll(/\/ActualText\s*<FEFF([0-9A-Fa-f]*)>/g)) {
      const hex = a[1]!;
      let s = "";
      for (let i = 0; i + 4 <= hex.length; i += 4) s += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
      out.push(s);
    }
  }
  return out;
}
const embeddedFonts = (buf: Buffer) => [...buf.toString("latin1").matchAll(/\/FontName\s*\/[A-Z]{6}\+([A-Za-z0-9-]+)/g)].map((m) => m[1]!);

const base = (over: Record<string, unknown> = {}, profileOver: Record<string, unknown> = {}) => ResumeDocument.parse({
  schemaVersion: 1, id: "r1", title: "CV", country: "US", locale: "en", templateId: "ats-minimal-01", pageSize: "Letter",
  sectionOrder: ["summary", "experience", "education", "skills", "languages"],
  profile: {
    schemaVersion: 1,
    personal: { fullName: "Ayesha Khan", professionalTitle: "Senior Software Engineer", email: "ayesha@example.com", phone: "+966 55 123 4567",
      location: { city: "Riyadh" }, linkedin: "https://linkedin.com/in/ayesha" },
    summary: "Software engineer with five years of experience building web and mobile products.",
    experience: [
      { id: "w1", employer: "Tech Solutions Co.", title: "Senior Software Engineer", dates: { start: "2021-01", current: true },
        bullets: [{ id: "b1", text: "Led a team of 4 developers on client projects" }, { id: "b2", text: "Improved application performance by 40%" }] },
      { id: "w2", employer: "Startup Co", title: "Software Engineer", dates: { start: "2018-06", end: "2020-12" }, bullets: [{ id: "b3", text: "Built React front-end features" }] },
    ],
    education: [{ id: "e1", institution: "King Saud University", qualification: "B.Sc. Computer Science", dates: { start: "2014", end: "2018" } }],
    skills: ["React", "Node.js", "TypeScript"].map((name, i) => ({ id: `s${i}`, name })),
    languages: [{ id: "l1", language: "Arabic", proficiency: "native" }],
    ...profileOver,
  },
  ...over,
});
const norm = (s: string) => s.normalize("NFKC").replace(/\s+/g, "").toLowerCase();

afterAll(async () => { if (enabled) await closeBrowser(); });

describe.skipIf(!enabled)("PDF export (Chromium)", () => {
  it.each(TEMPLATES.map((t) => [t.id, t] as const))("%s → valid PDF with selectable text, no blank pages", async (_id, t) => {
    const doc = base({ templateId: t.id });
    const pdf = await renderPdf(renderResumeHtml(doc, t), { pageSize: doc.pageSize });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    const r = await readPdf(pdf);
    for (const needle of ["Ayesha Khan", "Work Experience", "Led a team of 4 developers on client projects", "King Saud University", "TypeScript"]) {
      expect(norm(r.text), `${t.id}: ${needle}`).toContain(norm(needle));
    }
    expect(r.pages.every((p) => p.length > 0), `${t.id} has a blank page`).toBe(true);
    expect(r.text, `${t.id}: unmapped glyphs (ligatures?)`).not.toContain("\u0000");
    expect(r.pages.length).toBeLessThanOrEqual(2);
  }, 30_000);

  it("links are clickable (LinkedIn, mailto)", async () => {
    const r = await readPdf(await renderPdf(renderResumeHtml(base(), TEMPLATES[0]!), { pageSize: "Letter" }));
    expect(r.links).toContain("https://linkedin.com/in/ayesha");
    expect(r.links).toContain("mailto:ayesha@example.com");
  });

  it("long resumes paginate: several pages, none blank, entries intact", async () => {
    const roles = Array.from({ length: 18 }, (_, i) => ({
      id: `w${i}`, employer: `Company ${i + 1}`, title: `Role ${i + 1}`, dates: { start: `${2000 + i}-01`, end: `${2000 + i}-12` },
      bullets: Array.from({ length: 4 }, (_, j) => ({ id: `b${i}-${j}`, text: `Delivered project ${j + 1} for client ${i + 1} with a cross-functional team` })),
    }));
    const doc = base({}, { experience: roles });
    const r = await readPdf(await renderPdf(renderResumeHtml(doc, TEMPLATES[0]!), { pageSize: "A4" }));
    expect(r.pages.length).toBeGreaterThanOrEqual(3);
    expect(r.pages.every((p) => p.length > 20)).toBe(true);
    for (let i = 1; i <= 18; i++) expect(r.text).toContain(`Company ${i}`);
  }, 30_000);

  it.each([
    ["ar", "NotoSansArabic", RESUME_HEADINGS.ar!.experience],
    ["ur", "NotoNastaliqUrdu", RESUME_HEADINGS.ur!.experience],
    ["hi", "NotoSansDevanagari", RESUME_HEADINGS.hi!.experience],
    ["ja", "NotoSansJP", RESUME_HEADINGS.ja!.experience],
    ["zh", "NotoSansSC", RESUME_HEADINGS.zh!.experience],
  ])("%s resume embeds %s and has extractable script text", async (locale, font, heading) => {
    const doc = base({ locale, country: "SA", pageSize: "A4" });
    const pdf = await renderPdf(renderResumeHtml(doc, TEMPLATES[0]!), { pageSize: "A4" });
    expect(embeddedFonts(pdf).some((f) => f.startsWith(font))).toBe(true);
    const r = await readPdf(pdf);
    const actual = actualTexts(pdf);
    // Glyphs without a ToUnicode mapping must come with ActualText (one entry may cover a multi-glyph cluster,
    // e.g. Nastaliq base + dots), which is what ActualText-aware readers extract.
    const unmapped = (r.text.match(/\u0000/g) ?? []).length;
    if (unmapped > 0) expect(actual.length).toBeGreaterThan(0);
    // All letters of the localized heading are extractable (mapped glyphs ∪ ActualText), NFKC-normalised.
    const have = new Set([...norm(r.text + actual.join(""))]);
    const missing = [...norm(heading)].filter((ch) => !have.has(ch));
    expect(missing).toEqual([]);
    const t = norm(r.text);
    expect(t).toContain("ayesha@example.com");
  }, 30_000);

  it("preview and export contain the same text (5C consistency)", async () => {
    const html = renderResumeHtml(base(), TEMPLATES[0]!);
    const previewText = html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<title>[\s\S]*?<\/title>/g, "").replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
    const pdfText = norm((await readPdf(await renderPdf(html, { pageSize: "Letter" }))).text);
    const words = previewText.split(/\s+/).filter((w) => w.length > 1);
    const missing = words.filter((w) => !pdfText.includes(norm(w)));
    expect(missing).toEqual([]);
  });

  it("renderer blocks network fetches from resume content", async () => {
    const blocked: string[] = [];
    const html = renderResumeHtml(base(), TEMPLATES[0]!).replace("</main>", `<img src="https://tracker.example/pixel.png"></main>`);
    const pdf = await renderPdf(html, { pageSize: "Letter", onBlocked: (u) => blocked.push(u) });
    expect(pdf.length).toBeGreaterThan(1000);
    expect(blocked).toContain("https://tracker.example/pixel.png");
  });
});
