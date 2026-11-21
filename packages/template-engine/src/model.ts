/**
 * Format-neutral resume content: what every output (HTML/PDF, DOCX) shows, already localized and formatted.
 * Parity with renderResumeHtml is enforced by tests (same headings, dates, entries, hidden items).
 */
import type { ResumeDocument, SectionKey } from "@gars/resume-schema";
import { formatResumeDate, recommendResumeSettings } from "@gars/country-rules";
import { textDirection } from "@gars/localization";
import { headingsFor } from "./headings";

export interface ContactItem { label: string; value: string; href?: string; /** keep left-to-right inside RTL text */ ltr: boolean }
export interface Entry { title: string; org?: string; dates?: string; meta?: string; paragraphs: string[]; bullets: string[]; link?: string }
export interface ModelSection { key: SectionKey; heading: string; text?: string; list?: string[]; entries?: Entry[] }
export interface ContentModel {
  locale: string;
  rtl: boolean;
  pageSize: "A4" | "Letter";
  name: string;
  title?: string;
  contact: ContactItem[];
  sections: ModelSection[];
  /** Separator between title and organisation ("، " for Arabic-script locales). */
  orgSeparator: string;
}

function monthNames(locale: string): string[] {
  try {
    const f = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });
    return Array.from({ length: 12 }, (_, i) => f.format(new Date(Date.UTC(2020, i, 15))));
  } catch {
    return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  }
}

/** Contact labels in the RESUME language (machine-drafted, pending native review; English fallback). */
const CONTACT_LABELS: Record<string, { email: string; phone: string; location: string; web: string }> = {
  en: { email: "Email", phone: "Phone", location: "Location", web: "Web" },
  ar: { email: "البريد", phone: "الهاتف", location: "الموقع", web: "الموقع الإلكتروني" },
  ur: { email: "ای میل", phone: "فون", location: "مقام", web: "ویب سائٹ" },
  fr: { email: "E-mail", phone: "Téléphone", location: "Lieu", web: "Site web" },
  de: { email: "E-Mail", phone: "Telefon", location: "Ort", web: "Website" },
  es: { email: "Correo", phone: "Teléfono", location: "Ubicación", web: "Sitio web" },
  it: { email: "E-mail", phone: "Telefono", location: "Località", web: "Sito web" },
  pt: { email: "E-mail", phone: "Telefone", location: "Localização", web: "Site" },
  hi: { email: "ईमेल", phone: "फ़ोन", location: "स्थान", web: "वेबसाइट" },
  tr: { email: "E-posta", phone: "Telefon", location: "Konum", web: "Web sitesi" },
  zh: { email: "邮箱", phone: "电话", location: "所在地", web: "网站" },
  ja: { email: "メール", phone: "電話", location: "所在地", web: "ウェブサイト" },
};
export function contactLabels(locale: string) {
  return CONTACT_LABELS[locale.split("-")[0]!] ?? CONTACT_LABELS.en!;
}

/** Deep-copy strings without explicit bidi override/isolate controls (same rule as the HTML renderer). */
function stripControlsDeep<T>(v: T): T {
  if (typeof v === "string") return v.replace(/[\u202A-\u202E\u2066-\u2069]/g, "") as T;
  if (Array.isArray(v)) return v.map(stripControlsDeep) as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, stripControlsDeep(x)])) as T;
  return v;
}

export function buildContentModel(doc: ResumeDocument, opts: { dateFormat?: Parameters<typeof formatResumeDate>[1] } = {}): ContentModel {
  const p = stripControlsDeep(doc.profile);
  const h = headingsFor(doc.locale);
  const df = opts.dateFormat ?? recommendResumeSettings(doc.country).dateFormat;
  const months = monthNames(doc.locale);
  const fmt = (d?: string) => (d ? formatResumeDate(d, df, months) : "");
  const range = (s?: string, e?: string, cur?: boolean) => [fmt(s), cur ? h.present : fmt(e)].filter(Boolean).join(" – ") || undefined;
  const hidden = new Set(doc.hiddenItemIds);
  const vis = <T extends { id: string }>(xs: T[]) => xs.filter((x) => !hidden.has(x.id));
  const arabicScript = /^(ar|ur|fa)\b/.test(doc.locale);

  const L = contactLabels(doc.locale);
  const contact: ContactItem[] = [];
  const pd = p.personal;
  if (pd.email) contact.push({ label: L.email, value: pd.email, href: `mailto:${pd.email}`, ltr: true });
  if (pd.phone) contact.push({ label: L.phone, value: pd.phone, ltr: true });
  const loc = [pd.location.city, pd.location.region].filter(Boolean).join(", ");
  if (loc) contact.push({ label: L.location, value: loc, ltr: false });
  for (const [k, label] of [["linkedin", "LinkedIn"], ["website", L.web], ["portfolio", "Portfolio"]] as const) {
    const u = pd[k];
    if (u && /^https?:\/\//i.test(u)) contact.push({ label, value: u.replace(/^https?:\/\//, ""), href: u, ltr: true });
  }

  const generic = (xs: { title: string; subtitle?: string; date?: string; description?: string }[]): Entry[] =>
    xs.map((x) => ({ title: x.title, org: x.subtitle, dates: fmt(x.date) || undefined, paragraphs: x.description ? [x.description] : [], bullets: [] }));

  const sections: ModelSection[] = [];
  const push = (s: ModelSection) => {
    if (s.text || s.list?.length || s.entries?.length) sections.push(s);
  };
  for (const key of doc.sectionOrder.filter((k, i, a) => a.indexOf(k) === i)) {
    switch (key) {
      case "summary": push({ key, heading: h.summary, text: p.summary }); break;
      case "experience":
        push({ key, heading: h.experience, entries: vis(p.experience).map((w) => ({
          title: w.title, org: w.employer, dates: range(w.dates.start, w.dates.end, w.dates.current), meta: w.location,
          paragraphs: w.description ? [w.description] : [], bullets: w.bullets.map((b) => b.text),
        })) });
        break;
      case "education":
        push({ key, heading: h.education, entries: vis(p.education).map((e) => ({
          title: e.qualification + (e.field ? ` — ${e.field}` : ""), org: e.institution, dates: range(e.dates.start, e.dates.end, e.dates.current),
          meta: e.grade, paragraphs: e.notes ? [e.notes] : [], bullets: [],
        })) });
        break;
      case "skills": push({ key, heading: h.skills, list: vis(p.skills).map((s) => s.name) }); break;
      case "certifications":
        push({ key, heading: h.certifications, entries: vis(p.certifications).map((c) => ({
          title: c.name, org: c.issuer, dates: fmt(c.issued) || undefined, paragraphs: [], bullets: [], link: c.credentialUrl,
        })) });
        break;
      case "languages": push({ key, heading: h.languages, list: vis(p.languages).map((l) => l.language + (l.proficiency ? ` — ${l.proficiency}` : "")) }); break;
      case "projects":
        push({ key, heading: h.projects, entries: vis(p.projects).map((x) => ({
          title: x.name, org: x.role, dates: range(x.dates?.start, x.dates?.end, x.dates?.current), paragraphs: x.description ? [x.description] : [], bullets: [], link: x.url,
        })) });
        break;
      case "publications": case "awards": case "volunteer": case "references":
        push({ key, heading: h[key], entries: generic(vis(p[key])) });
        break;
      case "custom":
        for (const cs of vis(p.customSections)) push({ key, heading: cs.heading, entries: generic(vis(cs.entries)) });
        break;
    }
  }
  return {
    locale: doc.locale, rtl: textDirection(doc.locale) === "rtl", pageSize: doc.pageSize,
    name: pd.fullName, title: pd.professionalTitle, contact, sections, orgSeparator: arabicScript ? "، " : ", ",
  };
}
