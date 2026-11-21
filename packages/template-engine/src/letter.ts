/**
 * Cover letter rendering (HTML → PDF), sharing resume conventions: bundled script fonts, bidi isolation,
 * ligatures off for non-Arabic-script letters, RTL by letter language, bidi override controls stripped.
 */
import { textDirection } from "@gars/localization";
import { contactLabels } from "./model";
import { esc, fontStack } from "./render";

export interface LetterInput {
  body: string;              // paragraphs separated by blank lines (user-edited)
  locale: string;
  pageSize: "A4" | "Letter";
  dateText?: string;         // already localized by caller (keeps rendering deterministic)
  sender: { fullName: string; professionalTitle?: string; email?: string; phone?: string; city?: string };
  accent?: string;
  fontStyle?: "sans" | "serif" | "humanist" | "mono_accent";
}

export function letterParagraphs(body: string): string[] {
  return body.replace(/\r\n/g, "\n").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}

export function renderCoverLetterHtml(l: LetterInput): string {
  const rtl = textDirection(l.locale) === "rtl";
  const accent = /^#[0-9a-fA-F]{6}$/.test(l.accent ?? "") ? l.accent! : "#1F2A5A";
  const arabicScript = /^(ar|ur|fa)\b/.test(l.locale);
  const L = contactLabels(l.locale);
  const ut = (s: string) => `<bdi>${esc(s)}</bdi>`;
  const iso = (s: string) => (rtl ? `<bdi dir="ltr">${esc(s)}</bdi>` : esc(s));
  const contact = [
    l.sender.email ? `<span><span class="lbl">${esc(L.email)}:</span> ${iso(l.sender.email)}</span>` : "",
    l.sender.phone ? `<span><span class="lbl">${esc(L.phone)}:</span> ${iso(l.sender.phone)}</span>` : "",
    l.sender.city ? `<span><span class="lbl">${esc(L.location)}:</span> ${ut(l.sender.city)}</span>` : "",
  ].filter(Boolean).join("");
  const paras = letterParagraphs(l.body).map((p) => `<p>${p.split("\n").map(ut).join("<br>")}</p>`).join("");
  const css = `
@page { size: ${l.pageSize}; margin: 22mm 20mm; }
html { font-family: ${fontStack(l.fontStyle ?? "sans", l.locale)}; font-size: 11pt; line-height: ${l.locale.startsWith("ur") ? 1.95 : 1.5}; color: #1a1d29; }
${arabicScript ? "" : `html { font-variant-ligatures: no-common-ligatures no-discretionary-ligatures no-contextual; font-feature-settings: "liga" 0, "dlig" 0, "calt" 0; }`}
body { margin: 0; }
main, main * { overflow-wrap: anywhere; }
header { border-block-end: 2px solid ${accent}; padding-block-end: 8px; margin-block-end: 18px; }
h1 { margin: 0; font-size: 1.6em; color: ${accent}; }
.title { margin: 2px 0 6px; color: #4a4f63; }
.contact { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: .9em; color: #4a4f63; }
.lbl { font-weight: 600; }
.date { color: #4a4f63; margin: 0 0 14px; }
p { margin: 0 0 10px; break-inside: avoid; }`;
  return `<!doctype html><html lang="${esc(l.locale)}" dir="${rtl ? "rtl" : "ltr"}"><head><meta charset="utf-8">` +
    `<title>${esc(l.sender.fullName)} — Cover letter</title><style>${css}</style></head><body><main class="letter">` +
    `<header><h1>${ut(l.sender.fullName)}</h1>${l.sender.professionalTitle ? `<p class="title">${ut(l.sender.professionalTitle)}</p>` : ""}` +
    `${contact ? `<div class="contact">${contact}</div>` : ""}</header>` +
    `${l.dateText ? `<p class="date">${esc(l.dateText)}</p>` : ""}${paras}</main></body></html>`;
}

/**
 * Localized long date following the target country's convention when known:
 * en+US "November 21, 2026", en+GB "21 November 2026", ar "٢١ نوفمبر ٢٠٢٦", ja "2026年11月21日".
 */
export function letterDate(locale: string, d: Date = new Date(), country?: string): string {
  const base = locale.split("-")[0]!;
  const tag = country && /^[A-Z]{2}$/.test(country) ? `${base}-${country}` : locale;
  try { return new Intl.DateTimeFormat(tag, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(d); }
  catch { return d.toISOString().slice(0, 10); }
}
