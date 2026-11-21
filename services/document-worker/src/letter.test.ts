/** Phase 12A cover letter documents. DOCX always; PDF with PDF_IT=1 (real Chromium). */
import { afterAll, describe, expect, it } from "vitest";
import JSZip from "jszip";
import mammoth from "mammoth";
import { letterDate, renderCoverLetterHtml, type LetterInput } from "@gars/template-engine";
import { buildCoverLetterDocx } from "./docx";
import { closeBrowser, renderPdf } from "./pdf";

const body = "Dear Hiring Manager,\n\nI am applying for the Site Engineer role at Red Sea Builders. At Al Bina I supervised construction of 3 residential buildings.\n\nI work daily with AutoCAD and Primavera.\n\nSincerely,\nOmar Haddad";
const letter = (over: Partial<LetterInput> = {}): LetterInput => ({
  body, locale: "en", pageSize: "A4", dateText: letterDate("en", new Date("2026-11-21T00:00:00Z"), "GB"),
  sender: { fullName: "Omar Haddad", professionalTitle: "Site Engineer", email: "omar@example.com", phone: "+966 50 000 0000", city: "Jeddah" },
  accent: "#1F2A5A", ...over,
});

describe("cover letter DOCX", () => {
  it("editable paragraphs, header, date; LTR has no RTL flags", async () => {
    const buf = await buildCoverLetterDocx(letter());
    const { value } = await mammoth.convertToHtml({ buffer: buf });
    expect(value).toContain("<h1>Omar Haddad</h1>");
    expect(value).toContain("<p>Dear Hiring Manager,</p>");
    expect(value).toContain("21 November 2026");
    expect(value).toMatch(/Sincerely,<br \/>Omar Haddad/);
    const xml = await (await JSZip.loadAsync(buf)).file("word/document.xml")!.async("string");
    expect(xml).not.toMatch(/<w:(bidi|rtl)\b/);
  });
  it("Arabic letter is RTL with a localized date", async () => {
    const buf = await buildCoverLetterDocx(letter({ locale: "ar", body: "السادة مدير التوظيف،\n\nأتقدم لوظيفة مهندس موقع.", dateText: letterDate("ar", new Date("2026-11-21T00:00:00Z")) }));
    const xml = await (await JSZip.loadAsync(buf)).file("word/document.xml")!.async("string");
    expect(xml).toContain("<w:bidi/>");
    expect(xml).toContain("نوفمبر");
  });
  it("date follows the target country's convention", () => {
    const d = new Date("2026-11-21T00:00:00Z");
    expect(letterDate("en", d, "US")).toBe("November 21, 2026");
    expect(letterDate("en", d, "GB")).toBe("21 November 2026");
    expect(letterDate("de", d, "DE")).toBe("21. November 2026");
    expect(letterDate("ja", d, "JP")).toBe("2026年11月21日");
  });
  it("HTML escapes user text and strips bidi overrides", () => {
    const html = renderCoverLetterHtml(letter({ body: "Hi <script>alert(1)</script> ‮evil" }));
    expect(html).not.toContain("<script>alert");
    expect(html).not.toMatch(/‮/);
  });
});

const pdfIt = process.env.PDF_IT === "1";
afterAll(async () => { if (pdfIt) await closeBrowser(); });
describe.skipIf(!pdfIt)("cover letter PDF (Chromium)", () => {
  async function text(buf: Buffer) {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const d = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: false }).promise;
    const t = (await (await d.getPage(1)).getTextContent()).items.map((x) => ("str" in x ? x.str : "")).join(" ");
    const n = d.numPages; await d.destroy(); return { t, n };
  }
  it("English letter: one page, all text extractable, no unmapped glyphs", async () => {
    const r = await text(await renderPdf(renderCoverLetterHtml(letter()), { pageSize: "A4" }));
    expect(r.n).toBe(1);
    for (const w of ["Omar Haddad", "Dear Hiring Manager", "Red Sea Builders", "AutoCAD", "21 November 2026", "omar@example.com"]) expect(r.t.replace(/\s+/g, " ")).toContain(w);
    expect(r.t).not.toContain("\u0000");
  });
  it("Arabic letter renders RTL with the contact email kept LTR", async () => {
    const html = renderCoverLetterHtml(letter({ locale: "ar", body: "السادة مدير التوظيف،\n\nأتقدم لوظيفة مهندس موقع في Red Sea Builders." }));
    expect(html).toMatch(/dir="rtl"/);
    expect(html).toContain('<bdi dir="ltr">omar@example.com</bdi>');
    const r = await text(await renderPdf(html, { pageSize: "A4" }));
    expect(r.t).toContain("Red Sea Builders");
    expect(r.t).toContain("omar@example.com");
  });
});
