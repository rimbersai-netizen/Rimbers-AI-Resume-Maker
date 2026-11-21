/**
 * Editable Word (.docx) export from the shared content model — real Heading styles, real numbered bullet lists,
 * hyperlinks, page size/margins, and right-to-left paragraphs/runs for Arabic-script resumes.
 * Layout: single column (most ATS-friendly and easiest to edit); template accent colour and heading rule carry over.
 */
import {
  AlignmentType, BorderStyle, Document, ExternalHyperlink, HeadingLevel, ImageRun, LevelFormat, Packer, Paragraph,
  TabStopType, TextRun, type IRunOptions, type ParagraphChild,
} from "docx";
import type { ResumeDocument } from "@gars/resume-schema";
import { buildContentModel, type ContentModel, type TemplateSpec } from "@gars/template-engine";

const PAGE = { A4: { width: 11906, height: 16838 }, Letter: { width: 12240, height: 15840 } } as const;
const MARGIN = 794; // ≈14 mm, matches the PDF @page margin

/** Fonts commonly available in Microsoft Office / Windows / macOS; Word substitutes gracefully otherwise. */
function wordFonts(locale: string, style: TemplateSpec["typography"]["fontStack"]) {
  const latin = style === "serif" ? "Georgia" : "Calibri";
  const base = locale.split("-")[0];
  const cs = base === "ur" ? "Urdu Typesetting" : base === "hi" ? "Nirmala UI" : "Arial";
  const eastAsia = base === "ja" ? "Yu Gothic" : base === "zh" ? "Microsoft YaHei" : latin;
  return { ascii: latin, hAnsi: latin, cs, eastAsia };
}

function languageTag(locale: string) {
  const b = locale.split("-")[0];
  const value = ({ en: "en-US", fr: "fr-FR", de: "de-DE", es: "es-ES", it: "it-IT", pt: "pt-BR", tr: "tr-TR", hi: "hi-IN" } as Record<string, string>)[b!] ?? "en-US";
  const bidirectional = b === "ur" ? "ur-PK" : b === "fa" ? "fa-IR" : "ar-SA";
  const eastAsia = b === "ja" ? "ja-JP" : b === "zh" ? "zh-CN" : "ja-JP";
  return { value, bidirectional, eastAsia };
}

export interface DocxOptions {
  photo?: { data: Buffer; type: "png" | "jpg" };
  includePhoto?: boolean;
}

export async function buildDocx(doc: ResumeDocument, spec: TemplateSpec, opts: DocxOptions = {}): Promise<Buffer> {
  const m: ContentModel = buildContentModel(doc);
  const rtl = m.rtl;
  // Emit RTL flags only when true: some readers (e.g. Apple's) treat <w:bidi w:val="false"/> as RTL.
  const RTL = rtl ? true : undefined;
  const accent = spec.accent.replace("#", "").toUpperCase();
  const page = PAGE[m.pageSize];
  const contentWidth = page.width - 2 * MARGIN;
  const fonts = wordFonts(m.locale, spec.typography.fontStack);
  const run = (text: string, o: Partial<IRunOptions> = {}) => new TextRun({ text, rightToLeft: RTL, ...o });
  const para = (children: ParagraphChild[], o: Record<string, unknown> = {}) =>
    new Paragraph({ bidirectional: RTL, alignment: AlignmentType.START, children, ...o });

  const children: Paragraph[] = [];

  // Header: name (Heading 1), title, contact line
  if (opts.includePhoto && opts.photo && spec.layout.photo !== "none") {
    children.push(para([new ImageRun({ type: opts.photo.type, data: opts.photo.data, transformation: { width: 84, height: 84 }, altText: { name: m.name, description: m.name, title: m.name } })]));
  }
  children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, bidirectional: RTL, children: [run(m.name)] }));
  if (m.title) children.push(para([run(m.title, { color: accent, size: 24 })], { spacing: { after: 80 } }));
  if (m.contact.length) {
    const parts: ParagraphChild[] = [];
    m.contact.forEach((c, i) => {
      if (i > 0) parts.push(run("   ·   ", { color: "888888" }));
      parts.push(run(`${c.label}: `, { bold: true }));
      // Contact values (email/phone/URLs) stay left-to-right even inside RTL paragraphs.
      const value = new TextRun({ text: c.value, rightToLeft: rtl && !c.ltr ? true : undefined, style: c.href ? "Hyperlink" : undefined });
      parts.push(c.href ? new ExternalHyperlink({ link: c.href, children: [value] }) : value);
    });
    children.push(para(parts, { spacing: { after: 200 } }));
  }

  const headingBorder = spec.layout.headingStyle === "rule" || spec.layout.headingStyle === "block"
    ? { bottom: { style: BorderStyle.SINGLE, size: 8, color: accent, space: 2 } } : undefined;
  const headingCaps = spec.layout.headingStyle === "caps_spaced";

  for (const s of m.sections) {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_2, bidirectional: RTL, border: headingBorder, keepNext: true,
      children: [run(s.heading, { allCaps: headingCaps, color: accent })],
    }));
    if (s.text) children.push(para([run(s.text)]));
    if (s.list?.length) {
      // Skills/languages: comma list stays one editable paragraph (ATS-friendly).
      children.push(para([run(s.list.join(m.orgSeparator))]));
    }
    for (const e of s.entries ?? []) {
      const head: ParagraphChild[] = [run(e.title, { bold: true })];
      if (e.org) head.push(run(`${m.orgSeparator}${e.org}`));
      if (e.dates) head.push(run(`\t${e.dates}`, { color: "555555" }));
      children.push(para(head, { keepNext: true, tabStops: [{ type: TabStopType.RIGHT, position: contentWidth }], spacing: { before: 120 } }));
      if (e.meta) children.push(para([run(e.meta, { color: "555555", italics: true })], { keepNext: e.bullets.length > 0 }));
      for (const text of e.paragraphs) children.push(para([run(text)]));
      for (const b of e.bullets) children.push(para([run(b)], { numbering: { reference: "bullets", level: 0 } }));
      if (e.link && /^https?:\/\//i.test(e.link)) {
        children.push(para([new ExternalHyperlink({ link: e.link, children: [new TextRun({ text: e.link, style: "Hyperlink" })] })]));
      }
    }
  }

  const document = new Document({
    creator: "Global AI Resume Studio",
    title: `${m.name} — ${doc.title}`,
    description: "Resume generated by Global AI Resume Studio",
    styles: {
      default: {
        document: { run: { font: fonts, size: 21, language: languageTag(m.locale) }, paragraph: { spacing: { after: 60, line: m.locale.startsWith("ur") ? 360 : 276 } } },
        heading1: { run: { font: fonts, size: 40, bold: true, color: "141A3C" }, paragraph: { spacing: { after: 40 } } },
        heading2: { run: { font: fonts, size: 24, bold: true }, paragraph: { spacing: { before: 240, after: 80 } } },
      },
    },
    numbering: {
      config: [{
        reference: "bullets",
        levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.START, style: { paragraph: { indent: { start: 360, hanging: 240 } } } }],
      }],
    },
    sections: [{
      properties: { page: { size: page, margin: { top: MARGIN, bottom: MARGIN + 113, left: MARGIN, right: MARGIN } } },
      children,
    }],
  });
  return Packer.toBuffer(document);
}

// ---------------------------------------------------------------- cover letter DOCX (Phase 12A)
import { letterParagraphs, type LetterInput } from "@gars/template-engine";

export async function buildCoverLetterDocx(l: LetterInput): Promise<Buffer> {
  const rtl = /^(ar|ur|fa)\b/.test(l.locale);
  const RTL = rtl ? true : undefined;
  const accent = (l.accent ?? "#1F2A5A").replace("#", "").toUpperCase();
  const fonts = wordFonts(l.locale, l.fontStyle ?? "sans");
  const page = PAGE[l.pageSize];
  const run = (text: string, o: Partial<IRunOptions> = {}) => new TextRun({ text, rightToLeft: RTL, ...o });
  const para = (children: ParagraphChild[], o: Record<string, unknown> = {}) => new Paragraph({ bidirectional: RTL, alignment: AlignmentType.START, children, ...o });
  const contact = [l.sender.email, l.sender.phone, l.sender.city].filter(Boolean).join("   ·   ");
  const children: Paragraph[] = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, bidirectional: RTL, children: [run(l.sender.fullName, { color: accent })] }),
    ...(l.sender.professionalTitle ? [para([run(l.sender.professionalTitle, { color: "555555" })])] : []),
    ...(contact ? [para([new TextRun({ text: contact, color: "555555" })], { border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: accent, space: 6 } }, spacing: { after: 300 } })] : []),
    ...(l.dateText ? [para([run(l.dateText, { color: "555555" })], { spacing: { after: 240 } })] : []),
    ...letterParagraphs(l.body).map((p) => {
      const lines = p.split("\n");
      return para(lines.flatMap((line, i) => (i ? [run(line, { break: 1 })] : [run(line)])), { spacing: { after: 160 } });
    }),
  ];
  const document = new Document({
    creator: "Global AI Resume Studio",
    title: `${l.sender.fullName} — Cover letter`,
    styles: {
      default: {
        document: { run: { font: fonts, size: 22, language: languageTag(l.locale) }, paragraph: { spacing: { line: l.locale.startsWith("ur") ? 380 : 300 } } },
        heading1: { run: { font: fonts, size: 36, bold: true } },
      },
    },
    sections: [{ properties: { page: { size: page, margin: { top: 1247, bottom: 1247, left: 1134, right: 1134 } } }, children }],
  });
  return Packer.toBuffer(document);
}
