/**
 * Render a ResumeDocument to a self-contained, semantic HTML page.
 * - Real text and real headings (h1/h2/h3), CSS grid (never tables) → selectable, parseable PDF.
 * - Direction from the RESUME language; LTR fragments (email, phone, URLs) isolated in RTL documents.
 * - Print CSS: @page size from the document, entries avoid page breaks.
 */
import type { ResumeDocument, SectionKey } from "@gars/resume-schema";
import { formatResumeDate, recommendResumeSettings } from "@gars/country-rules";
import { textDirection } from "@gars/localization";
import { headingsFor } from "./headings";
import type { TemplateSpec } from "./spec";

export interface RenderOptions {
  /** Signed URL or data: URI for the photo. Only used if the document opts in AND the layout has a photo slot. */
  photoSrc?: string;
  /** Override date format; defaults to the country convention. */
  dateFormat?: Parameters<typeof formatResumeDate>[1];
}

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c]!);
const safeHref = (u: string) => (/^https?:\/\//i.test(u) ? esc(u) : "#");
const ltr = (s: string, rtl: boolean) => (rtl ? `<bdi dir="ltr">${esc(s)}</bdi>` : esc(s));

function monthNames(locale: string): string[] {
  try {
    const f = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });
    return Array.from({ length: 12 }, (_, i) => f.format(new Date(Date.UTC(2020, i, 15))));
  } catch {
    return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  }
}

const FONT_STACKS: Record<TemplateSpec["typography"]["fontStack"], string> = {
  sans: `"Inter", "Helvetica Neue", Arial`,
  serif: `"Source Serif 4", Georgia, "Times New Roman"`,
  humanist: `"Source Sans 3", "Segoe UI", Arial`,
  mono_accent: `"Inter", Arial`,
};
// Script fallbacks appended to every stack so Arabic/Urdu/Hindi/CJK always have glyphs.
const SCRIPT_FALLBACK = `"Noto Sans Arabic", "Noto Nastaliq Urdu", "Noto Sans Devanagari", "Noto Sans SC", "Noto Sans JP", sans-serif`;

function css(spec: TemplateSpec, pageSize: "A4" | "Letter", locale: string): string {
  const gap = { compact: 8, normal: 12, airy: 16 }[spec.spacing];
  const lh = locale.startsWith("ur") ? Math.max(spec.typography.lineHeight, 1.9) : spec.typography.lineHeight; // Nastaliq needs height
  const h2 = {
    rule: `border-block-end: 1.5px solid var(--accent); padding-block-end: 2px;`,
    underline: `text-decoration: underline; text-decoration-color: var(--accent); text-underline-offset: 3px;`,
    caps_spaced: `text-transform: uppercase; letter-spacing: .12em; font-size: .92em;`,
    block: `background: var(--accent); color: #fff; padding: 2px 8px;`,
    side_label: `color: var(--accent); font-size: .95em;`,
  }[spec.layout.headingStyle];
  const header = {
    left: `text-align: start;`,
    centered: `text-align: center;`,
    banner: `background: var(--accent); color: #fff; padding: 14px 18px; margin-inline: -4px;`,
    split: `display: flex; justify-content: space-between; align-items: end; gap: 16px;`,
    boxed: `border: 1.5px solid var(--accent); padding: 12px 16px;`,
  }[spec.layout.header];
  const columns = {
    single: `grid-template-columns: 1fr;`,
    sidebar_start: `grid-template-columns: 32% 1fr;`,
    sidebar_end: `grid-template-columns: 1fr 32%;`,
  }[spec.layout.columns];
  return `
@page { size: ${pageSize}; margin: 14mm 14mm 16mm; }
:root { --accent: ${spec.accent}; --text: #1a1d29; --muted: #4a4f63; }
* { box-sizing: border-box; }
html { font-family: ${FONT_STACKS[spec.typography.fontStack]}, ${SCRIPT_FALLBACK}; font-size: ${spec.typography.baseSizePt}pt; line-height: ${lh}; color: var(--text); }
body { margin: 0; }
.resume { max-width: 100%; }
header.top { ${header} margin-block-end: ${gap + 4}px; }
header.top h1 { margin: 0; font-size: 1.9em; line-height: 1.15; }
header.top .title { margin: 2px 0 0; font-size: 1.1em; ${spec.layout.header === "banner" ? "" : "color: var(--accent);"} }
header.top .photo { width: 84px; height: 84px; object-fit: cover; border-radius: ${spec.layout.photo === "circle" ? "50%" : "4px"}; }
.contact { list-style: none; padding: 0; margin: 6px 0 0; display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: .92em; }
.contact .lbl { font-weight: 600; }
.contact a { color: inherit; }
.cols { display: grid; ${columns} gap: ${gap * 2}px; }
section { margin-block-end: ${gap + 2}px; }
h2 { margin: 0 0 ${Math.round(gap / 2)}px; font-size: 1.12em; ${h2} break-after: avoid; }
.entry { margin-block-end: ${gap}px; break-inside: avoid; }
.entry h3 { margin: 0; font-size: 1em; }
.entry .org { font-weight: 400; }
.entry .meta { margin: 1px 0 3px; color: var(--muted); font-size: .92em; }
.entry.inline-dates .head { display: flex; justify-content: space-between; gap: 12px; }
.entry.start-dates { display: grid; grid-template-columns: 7.5em 1fr; gap: 10px; }
ul.bullets { margin: 2px 0 0; padding-inline-start: 1.1em; }
ul.bullets li { margin-block-end: 2px; }
.skills.comma p { margin: 0; }
.skills.chips ul, .skills.grid ul { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 4px 6px; }
.skills.chips li { border: 1px solid var(--accent); border-radius: 999px; padding: 0 8px; }
.skills.grid ul { display: grid; grid-template-columns: repeat(2, 1fr); }
p { margin: 0 0 4px; }
a { color: var(--accent); }
`;
}

interface Ctx {
  doc: ResumeDocument;
  spec: TemplateSpec;
  rtl: boolean;
  h: ReturnType<typeof headingsFor>;
  fmt: (d?: string) => string;
  hidden: Set<string>;
}

function range(c: Ctx, start?: string, end?: string, current?: boolean): string {
  const s = c.fmt(start);
  const e = current ? c.h.present : c.fmt(end);
  if (!s && !e) return "";
  return `<span class="dates">${esc([s, e].filter(Boolean).join(" – "))}</span>`;
}

function entry(c: Ctx, title: string, org: string | undefined, dates: string, extra: string, body: string): string {
  const head = `<h3>${esc(title)}${org ? `<span class="org">, ${esc(org)}</span>` : ""}</h3>`;
  const meta = [dates, extra].filter(Boolean).join(" · ");
  switch (c.spec.layout.datePlacement) {
    case "inline_end":
      return `<article class="entry inline-dates"><div class="head">${head}${dates}</div>${extra ? `<p class="meta">${extra}</p>` : ""}${body}</article>`;
    case "start_column":
      return `<article class="entry start-dates"><div class="meta">${dates}</div><div>${head}${extra ? `<p class="meta">${extra}</p>` : ""}${body}</div></article>`;
    default:
      return `<article class="entry">${head}${meta ? `<p class="meta">${meta}</p>` : ""}${body}</article>`;
  }
}

function section(c: Ctx, key: SectionKey, heading: string, inner: string): string {
  if (!inner.trim()) return "";
  const id = `sec-${key}-${Math.abs(hash(heading))}`;
  return `<section class="sec-${key}" aria-labelledby="${id}"><h2 id="${id}">${esc(heading)}</h2>${inner}</section>`;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

function renderSection(c: Ctx, key: SectionKey): string {
  const p = c.doc.profile;
  const vis = <T extends { id: string }>(xs: T[]) => xs.filter((x) => !c.hidden.has(x.id));
  const bullets = (xs: string[]) => (xs.length ? `<ul class="bullets">${xs.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : "");
  switch (key) {
    case "summary":
      return section(c, key, c.h.summary, p.summary ? `<p>${esc(p.summary)}</p>` : "");
    case "experience":
      return section(c, key, c.h.experience, vis(p.experience).map((w) =>
        entry(c, w.title, w.employer, range(c, w.dates.start, w.dates.end, w.dates.current), w.location ? esc(w.location) : "",
          (w.description ? `<p>${esc(w.description)}</p>` : "") + bullets(w.bullets.map((b) => b.text)))).join(""));
    case "education":
      return section(c, key, c.h.education, vis(p.education).map((e) =>
        entry(c, e.qualification + (e.field ? ` — ${e.field}` : ""), e.institution, range(c, e.dates.start, e.dates.end, e.dates.current),
          e.grade ? esc(e.grade) : "", e.notes ? `<p>${esc(e.notes)}</p>` : "")).join(""));
    case "skills": {
      const s = vis(p.skills).map((x) => x.name);
      if (!s.length) return "";
      const style = c.spec.layout.skillsStyle;
      const inner = style === "comma" ? `<p>${esc(s.join(", "))}</p>` : `<ul>${s.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
      return section(c, key, c.h.skills, `<div class="skills ${style}">${inner}</div>`);
    }
    case "certifications":
      return section(c, key, c.h.certifications, vis(p.certifications).map((x) =>
        entry(c, x.name, x.issuer, x.issued ? `<span class="dates">${esc(c.fmt(x.issued))}</span>` : "", "",
          x.credentialUrl ? `<p><a href="${safeHref(x.credentialUrl)}">${ltr(x.credentialUrl, c.rtl)}</a></p>` : "")).join(""));
    case "languages":
      return section(c, key, c.h.languages, vis(p.languages).length
        ? `<ul class="bullets">${vis(p.languages).map((l) => `<li>${esc(l.language)}${l.proficiency ? ` — ${esc(l.proficiency)}` : ""}</li>`).join("")}</ul>` : "");
    case "projects":
      return section(c, key, c.h.projects, vis(p.projects).map((x) =>
        entry(c, x.name, x.role, range(c, x.dates?.start, x.dates?.end, x.dates?.current), "",
          (x.description ? `<p>${esc(x.description)}</p>` : "") + (x.url ? `<p><a href="${safeHref(x.url)}">${ltr(x.url, c.rtl)}</a></p>` : ""))).join(""));
    case "publications": case "awards": case "volunteer": case "references": {
      const list = vis(p[key]);
      return section(c, key, c.h[key], list.map((x) =>
        entry(c, x.title, x.subtitle, x.date ? `<span class="dates">${esc(c.fmt(x.date))}</span>` : "", "",
          x.description ? `<p>${esc(x.description)}</p>` : "")).join(""));
    }
    case "custom":
      return vis(p.customSections).map((cs) => section(c, "custom", cs.heading, vis(cs.entries).map((x) =>
        entry(c, x.title, x.subtitle, x.date ? `<span class="dates">${esc(c.fmt(x.date))}</span>` : "", "",
          x.description ? `<p>${esc(x.description)}</p>` : "")).join(""))).join("");
  }
}

function headerHtml(c: Ctx, opts: RenderOptions): string {
  const pd = c.doc.profile.personal;
  const items: string[] = [];
  const item = (label: string, value: string) => items.push(`<li><span class="lbl">${esc(label)}:</span> ${value}</li>`);
  const L = c.doc.locale.startsWith("ar") ? { email: "البريد", phone: "الهاتف", location: "الموقع", web: "الموقع الإلكتروني" }
    : c.doc.locale.startsWith("ur") ? { email: "ای میل", phone: "فون", location: "مقام", web: "ویب سائٹ" }
    : { email: "Email", phone: "Phone", location: "Location", web: "Web" };
  if (pd.email) item(L.email, `<a href="mailto:${esc(pd.email)}">${ltr(pd.email, c.rtl)}</a>`);
  if (pd.phone) item(L.phone, ltr(pd.phone, c.rtl));
  const loc = [pd.location.city, pd.location.region].filter(Boolean).join(", ");
  if (loc) item(L.location, esc(loc));
  for (const [k, label] of [["linkedin", "LinkedIn"], ["website", L.web], ["portfolio", "Portfolio"]] as const) {
    const u = pd[k];
    if (u) item(label, `<a href="${safeHref(u)}">${ltr(u.replace(/^https?:\/\//, ""), c.rtl)}</a>`);
  }
  const showPhoto = c.doc.includePhoto && c.spec.layout.photo !== "none" && opts.photoSrc;
  const photo = showPhoto ? `<img class="photo" src="${esc(opts.photoSrc!)}" alt="${esc(pd.fullName)}">` : "";
  return `<header class="top">${photo}<div><h1>${esc(pd.fullName)}</h1>${pd.professionalTitle ? `<p class="title">${esc(pd.professionalTitle)}</p>` : ""}` +
    `${items.length ? `<ul class="contact" aria-label="${esc(c.h.contact)}">${items.join("")}</ul>` : ""}</div></header>`;
}

export function renderResumeHtml(doc: ResumeDocument, spec: TemplateSpec, opts: RenderOptions = {}): string {
  const rtl = textDirection(doc.locale) === "rtl";
  const df = opts.dateFormat ?? recommendResumeSettings(doc.country).dateFormat;
  const months = monthNames(doc.locale);
  const c: Ctx = { doc, spec, rtl, h: headingsFor(doc.locale), fmt: (d) => (d ? formatResumeDate(d, df, months) : ""), hidden: new Set(doc.hiddenItemIds) };

  const order = doc.sectionOrder.filter((k, i, a) => a.indexOf(k) === i);
  const sidebarKeys = new Set(spec.layout.columns === "sidebar_start" || spec.layout.columns === "sidebar_end" ? spec.layout.sidebarSections : []);
  const main = order.filter((k) => !sidebarKeys.has(k)).map((k) => renderSection(c, k)).join("");
  const side = order.filter((k) => sidebarKeys.has(k)).map((k) => renderSection(c, k)).join("");
  const body = sidebarKeys.size
    ? `<div class="cols">${spec.layout.columns === "sidebar_start" ? `<aside>${side}</aside><div class="main">${main}</div>` : `<div class="main">${main}</div><aside>${side}</aside>`}</div>`
    : `<div class="cols"><div class="main">${main}</div></div>`;

  return `<!doctype html><html lang="${esc(doc.locale)}" dir="${rtl ? "rtl" : "ltr"}"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(doc.profile.personal.fullName)} — ${esc(doc.title)}</title>` +
    `<meta name="generator" content="gars-template-engine; template=${esc(spec.id)}"><style>${css(spec, doc.pageSize, doc.locale)}</style></head>` +
    `<body><main class="resume tpl-${esc(spec.id)}">${headerHtml(c, opts)}${body}</main></body></html>`;
}
