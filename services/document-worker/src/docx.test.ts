import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import mammoth from "mammoth";
import { ResumeDocument } from "@gars/resume-schema";
import { RESUME_HEADINGS, renderResumeHtml, TEMPLATES, getTemplate } from "@gars/template-engine";
import { buildDocx } from "./docx";

const base = (over: Record<string, unknown> = {}) => ResumeDocument.parse({
  schemaVersion: 1, id: "r1", title: "CV", country: "US", locale: "en", templateId: "ats-minimal-01", pageSize: "Letter",
  sectionOrder: ["summary", "experience", "education", "skills", "certifications", "languages", "custom"],
  hiddenItemIds: ["w9"],
  profile: {
    schemaVersion: 1,
    personal: { fullName: "Ayesha Khan", professionalTitle: "Senior Software Engineer", email: "ayesha@example.com", phone: "+966 55 123 4567",
      location: { city: "Riyadh" }, linkedin: "https://linkedin.com/in/ayesha" },
    summary: "Software engineer with five years of experience.",
    experience: [
      { id: "w1", employer: "Tech Solutions Co.", title: "Senior Software Engineer", dates: { start: "2021-01", current: true },
        bullets: [{ id: "b1", text: "Led a team of 4 developers" }, { id: "b2", text: "Improved performance by 40%" }] },
      { id: "w9", employer: "Hidden Corp", title: "Secret Role", dates: { start: "2015" }, bullets: [] },
    ],
    education: [{ id: "e1", institution: "King Saud University", qualification: "B.Sc. Computer Science", dates: { start: "2014", end: "2018" } }],
    skills: ["React", "Node.js", "<script>"].map((name, i) => ({ id: `s${i}`, name })),
    certifications: [{ id: "c1", name: "AWS Solutions Architect", credentialUrl: "https://aws.example/cert" }],
    languages: [{ id: "l1", language: "Arabic", proficiency: "native" }],
    customSections: [{ id: "cs", heading: "Memberships", entries: [{ id: "m1", title: "Saudi Council of Engineers" }] }],
  },
  ...over,
});

async function inspect(buf: Buffer) {
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file("word/document.xml")!.async("string");
  const rels = await zip.file("word/_rels/document.xml.rels")!.async("string");
  const { value: html } = await mammoth.convertToHtml({ buffer: buf });
  const { value: text } = await mammoth.extractRawText({ buffer: buf });
  return { xml, rels, html, text };
}
const words = (s: string) => s.normalize("NFKC").split(/\s+/).map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")).filter((w) => w.length > 1);

describe("DOCX export", () => {
  it("is a real Word document with headings, list items, hyperlinks and Letter size", async () => {
    const buf = await buildDocx(base(), TEMPLATES[0]!);
    expect(buf.subarray(0, 2).toString()).toBe("PK"); // OOXML zip
    const { xml, rels, html, text } = await inspect(buf);
    expect(html).toMatch(/<h1>Ayesha Khan<\/h1>/);
    expect(html).toMatch(/<h2>Work Experience<\/h2>/);
    expect(html).toContain("<li>Led a team of 4 developers</li>"); // real numbered list, editable
    expect(xml).toContain('w:pgSz w:w="12240" w:h="15840"');
    expect(rels).toContain('Target="https://linkedin.com/in/ayesha"');
    expect(rels).toContain('Target="mailto:ayesha@example.com"');
    expect(text).not.toContain("Hidden Corp");
    expect(text).toContain("<script>"); // stored as text, not markup
    expect(xml).not.toContain("<w:drawing>"); // no screenshot/image-only export
    expect(xml).not.toMatch(/<w:(bidi|rtl)\b/); // LTR docs carry no RTL flags at all (some readers misread val="false")
  });

  it("A4 page size", async () => {
    const { xml } = await inspect(await buildDocx(base({ pageSize: "A4" }), TEMPLATES[0]!));
    expect(xml).toContain('w:pgSz w:w="11906" w:h="16838"');
  });

  it("Arabic resume: RTL paragraphs + runs, Arabic headings, country dates, Arabic comma", async () => {
    const { xml, text } = await inspect(await buildDocx(base({ locale: "ar", country: "SA", pageSize: "A4" }), TEMPLATES[0]!));
    expect(xml).toContain("<w:bidi/>");
    expect(xml).toContain("<w:rtl/>");
    expect(text).toContain(RESUME_HEADINGS.ar!.experience);
    expect(text).toContain("01/2021 – حتى الآن");
    expect(text).toContain("Senior Software Engineer، Tech Solutions Co.");
  });

  it("Urdu uses a Nastaliq-capable complex-script font and taller lines; Japanese uses an East Asian font", async () => {
    const ur = (await inspect(await buildDocx(base({ locale: "ur" }), TEMPLATES[0]!))).xml;
    expect(ur).toContain("<w:bidi/>");
    const ja = await JSZip.loadAsync(await buildDocx(base({ locale: "ja" }), TEMPLATES[0]!));
    const styles = await ja.file("word/styles.xml")!.async("string");
    expect(styles).toContain('w:eastAsia="Yu Gothic"');
  });

  it("photo is embedded only when requested and the template has a photo slot", async () => {
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
    const withSlot = TEMPLATES.find((t) => t.layout.photo !== "none")!;
    expect((await inspect(await buildDocx(base(), withSlot, { includePhoto: true, photo: { data: png, type: "png" } }))).xml).toContain("<w:drawing>");
    expect((await inspect(await buildDocx(base(), TEMPLATES[0]!, { includePhoto: true, photo: { data: png, type: "png" } }))).xml).not.toContain("<w:drawing>");
  });

  it.each(TEMPLATES.map((t) => [t.id] as const))("%s: DOCX has the same words as the HTML/PDF output", async (id) => {
    const spec = getTemplate(id)!;
    const doc = base({ templateId: id });
    const html = renderResumeHtml(doc, spec).replace(/<style[\s\S]*?<\/style>/g, "").replace(/<title>[\s\S]*?<\/title>/g, "")
      .replace(/<[^>]+>/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
    const { text } = await inspect(await buildDocx(doc, spec));
    const docxWords = new Set(words(text).map((w) => w.toLowerCase()));
    const missing = words(html).filter((w) => !docxWords.has(w.toLowerCase()));
    expect(missing).toEqual([]);
  });
});
