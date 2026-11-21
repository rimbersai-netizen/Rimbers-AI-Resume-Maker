/**
 * Template library: 105 original layouts (5 per category × 21 categories), generated deterministically
 * from structural dimensions. Uniqueness is by `layoutKey` (structure) — colour is never counted.
 * Each category constrains dimensions to suit its audience (e.g. ATS Minimal = single column, no photo,
 * no skill graphics).
 */
import { TemplateSpec, TEMPLATE_CATEGORIES, layoutKey, type LayoutSpec } from "./spec";

type Cat = (typeof TEMPLATE_CATEGORIES)[number];
type Dim<K extends keyof LayoutSpec> = LayoutSpec[K][];

interface CategoryRule {
  label: string;
  columns: Dim<"columns">;
  header: Dim<"header">;
  headingStyle: Dim<"headingStyle">;
  datePlacement: Dim<"datePlacement">;
  skillsStyle: Dim<"skillsStyle">;
  photo: Dim<"photo">;
  fonts: TemplateSpec["typography"]["fontStack"][];
  /** Dark accents only: ≥4.5:1 against white for both text and white-on-accent blocks. */
  accents: string[];
  spacing: TemplateSpec["spacing"][];
  premiumFrom: number; // index from which templates in this category are premium
}

const NAVY = "#1F2A5A", INDIGO = "#3B2F8F", PURPLE = "#5B2EC8", TEAL = "#0F5E63", GREEN = "#1F5F3A", MAROON = "#7A1F2B",
  SLATE = "#2F3B4C", BROWN = "#6B3E1F", BLUE = "#1D4E89", CHARCOAL = "#222831", PLUM = "#5A2A5E", OLIVE = "#4A5222";

const RULES: Record<Cat, CategoryRule> = {
  ats_minimal:   { label: "ATS Minimal",   columns: ["single"], header: ["left", "centered", "split"], headingStyle: ["rule", "caps_spaced", "underline"], datePlacement: ["inline_end", "below_title"], skillsStyle: ["comma"], photo: ["none"], fonts: ["sans", "humanist"], accents: [CHARCOAL, NAVY, SLATE], spacing: ["normal", "compact"], premiumFrom: 99 },
  classic:       { label: "Classic",       columns: ["single"], header: ["left", "centered", "split"], headingStyle: ["rule", "caps_spaced", "underline"], datePlacement: ["inline_end", "start_column", "below_title"], skillsStyle: ["comma"], photo: ["none"], fonts: ["serif"], accents: [CHARCOAL, NAVY, MAROON], spacing: ["normal"], premiumFrom: 3 },
  modern:        { label: "Modern",        columns: ["sidebar_start", "single", "sidebar_end"], header: ["banner", "left", "split"], headingStyle: ["block", "rule", "side_label"], datePlacement: ["below_title", "inline_end"], skillsStyle: ["chips", "grid"], photo: ["circle", "none"], fonts: ["sans"], accents: [PURPLE, INDIGO, TEAL], spacing: ["normal", "airy"], premiumFrom: 2 },
  corporate:     { label: "Corporate",     columns: ["single", "sidebar_end"], header: ["boxed", "left", "split"], headingStyle: ["rule", "caps_spaced"], datePlacement: ["inline_end", "below_title"], skillsStyle: ["comma", "grid"], photo: ["none", "square"], fonts: ["humanist", "sans"], accents: [NAVY, BLUE, SLATE], spacing: ["normal"], premiumFrom: 3 },
  executive:     { label: "Executive",     columns: ["single", "sidebar_start"], header: ["centered", "banner", "boxed"], headingStyle: ["caps_spaced", "rule"], datePlacement: ["inline_end", "start_column"], skillsStyle: ["comma", "grid"], photo: ["none", "circle"], fonts: ["serif", "humanist"], accents: [NAVY, CHARCOAL, MAROON], spacing: ["airy", "normal"], premiumFrom: 1 },
  technical:     { label: "Technical",     columns: ["single", "sidebar_end", "sidebar_start"], header: ["left", "split"], headingStyle: ["side_label", "rule", "block"], datePlacement: ["inline_end", "below_title"], skillsStyle: ["grid", "chips", "comma"], photo: ["none"], fonts: ["mono_accent", "sans"], accents: [TEAL, INDIGO, SLATE], spacing: ["compact", "normal"], premiumFrom: 3 },
  engineering:   { label: "Engineering",   columns: ["single", "sidebar_start"], header: ["left", "boxed", "split"], headingStyle: ["rule", "block"], datePlacement: ["start_column", "inline_end"], skillsStyle: ["grid", "comma"], photo: ["none", "square"], fonts: ["sans", "humanist"], accents: [BLUE, SLATE, TEAL], spacing: ["normal", "compact"], premiumFrom: 3 },
  construction:  { label: "Construction",  columns: ["single", "sidebar_end"], header: ["banner", "left", "boxed"], headingStyle: ["block", "rule"], datePlacement: ["inline_end", "start_column"], skillsStyle: ["grid", "comma"], photo: ["none", "square"], fonts: ["sans"], accents: [BROWN, OLIVE, CHARCOAL], spacing: ["normal"], premiumFrom: 3 },
  healthcare:    { label: "Healthcare",    columns: ["single", "sidebar_start"], header: ["centered", "left", "split"], headingStyle: ["underline", "rule", "caps_spaced"], datePlacement: ["below_title", "inline_end"], skillsStyle: ["comma", "chips"], photo: ["none", "circle"], fonts: ["humanist"], accents: [TEAL, GREEN, BLUE], spacing: ["normal", "airy"], premiumFrom: 3 },
  finance:       { label: "Finance",       columns: ["single"], header: ["boxed", "left", "centered", "split"], headingStyle: ["rule", "caps_spaced", "underline"], datePlacement: ["inline_end", "start_column"], skillsStyle: ["comma", "grid"], photo: ["none"], fonts: ["serif", "humanist"], accents: [NAVY, GREEN, CHARCOAL], spacing: ["compact", "normal"], premiumFrom: 3 },
  accounting:    { label: "Accounting",    columns: ["single", "sidebar_end"], header: ["left", "split", "centered"], headingStyle: ["caps_spaced", "rule", "side_label"], datePlacement: ["start_column", "inline_end"], skillsStyle: ["grid", "comma"], photo: ["none"], fonts: ["humanist", "sans"], accents: [GREEN, NAVY, SLATE], spacing: ["compact"], premiumFrom: 3 },
  sales:         { label: "Sales",         columns: ["sidebar_start", "single"], header: ["banner", "split", "left"], headingStyle: ["block", "side_label", "rule"], datePlacement: ["below_title", "inline_end"], skillsStyle: ["chips", "comma"], photo: ["circle", "none"], fonts: ["sans"], accents: [BLUE, PURPLE, MAROON], spacing: ["normal", "airy"], premiumFrom: 3 },
  marketing:     { label: "Marketing",     columns: ["sidebar_end", "sidebar_start", "single"], header: ["banner", "split", "centered"], headingStyle: ["side_label", "block", "underline"], datePlacement: ["below_title"], skillsStyle: ["chips", "grid"], photo: ["circle", "square", "none"], fonts: ["sans", "humanist"], accents: [PLUM, PURPLE, TEAL], spacing: ["airy"], premiumFrom: 2 },
  academic:      { label: "Academic",      columns: ["single"], header: ["centered", "left", "boxed"], headingStyle: ["caps_spaced", "underline", "rule"], datePlacement: ["start_column", "inline_end"], skillsStyle: ["comma"], photo: ["none"], fonts: ["serif"], accents: [MAROON, NAVY, CHARCOAL], spacing: ["normal", "compact"], premiumFrom: 3 },
  graduate:      { label: "Graduate",      columns: ["single", "sidebar_start"], header: ["left", "centered", "split"], headingStyle: ["rule", "block", "underline"], datePlacement: ["below_title", "inline_end"], skillsStyle: ["chips", "comma"], photo: ["none", "circle"], fonts: ["sans", "humanist"], accents: [INDIGO, TEAL, BLUE], spacing: ["normal", "airy"], premiumFrom: 99 },
  internship:    { label: "Internship",    columns: ["single", "sidebar_end"], header: ["left", "split", "banner"], headingStyle: ["underline", "rule", "side_label"], datePlacement: ["below_title"], skillsStyle: ["comma", "chips", "grid"], photo: ["none"], fonts: ["sans"], accents: [BLUE, PURPLE, GREEN], spacing: ["compact", "normal"], premiumFrom: 99 },
  legal:         { label: "Legal",         columns: ["single"], header: ["centered", "boxed", "left", "split"], headingStyle: ["caps_spaced", "rule", "underline"], datePlacement: ["inline_end", "start_column", "below_title"], skillsStyle: ["comma"], photo: ["none"], fonts: ["serif"], accents: [CHARCOAL, NAVY, MAROON], spacing: ["normal"], premiumFrom: 3 },
  hospitality:   { label: "Hospitality",   columns: ["sidebar_start", "single"], header: ["centered", "banner", "left"], headingStyle: ["underline", "block", "caps_spaced"], datePlacement: ["below_title", "inline_end"], skillsStyle: ["chips", "comma"], photo: ["circle", "none"], fonts: ["humanist"], accents: [MAROON, TEAL, PLUM], spacing: ["airy", "normal"], premiumFrom: 3 },
  creative:      { label: "Creative",      columns: ["sidebar_end", "sidebar_start"], header: ["banner", "split", "boxed"], headingStyle: ["side_label", "block", "underline"], datePlacement: ["below_title", "start_column"], skillsStyle: ["chips", "grid"], photo: ["circle", "square", "none"], fonts: ["sans", "humanist"], accents: [PLUM, PURPLE, TEAL], spacing: ["airy"], premiumFrom: 1 },
  government:    { label: "Government",    columns: ["single"], header: ["left", "centered", "boxed"], headingStyle: ["rule", "caps_spaced", "block"], datePlacement: ["start_column", "inline_end"], skillsStyle: ["comma", "grid"], photo: ["none", "square"], fonts: ["humanist", "serif"], accents: [NAVY, SLATE, GREEN], spacing: ["normal", "compact"], premiumFrom: 99 },
  international: { label: "International", columns: ["single", "sidebar_start", "sidebar_end"], header: ["split", "left", "centered"], headingStyle: ["rule", "block", "caps_spaced"], datePlacement: ["inline_end", "below_title"], skillsStyle: ["comma", "grid", "chips"], photo: ["none", "circle", "square"], fonts: ["sans", "humanist"], accents: [INDIGO, NAVY, TEAL], spacing: ["normal"], premiumFrom: 3 },
};

const SIDEBAR_SETS: LayoutSpec["sidebarSections"][] = [
  ["skills", "languages", "certifications"],
  ["skills", "languages", "certifications", "awards"],
  ["skills", "certifications", "languages", "references"],
];

const PER_CATEGORY = 5;

/** Mixed-radix walk with co-prime strides so consecutive picks differ in several dimensions. */
function* combos(r: CategoryRule): Generator<LayoutSpec> {
  const dims = [r.columns, r.header, r.headingStyle, r.datePlacement, r.skillsStyle, r.photo];
  const total = dims.reduce((n, d) => n * d.length, 1);
  for (let i = 0; i < total; i++) {
    let n = (i * 7919) % total;
    const pick = dims.map((d) => { const v = d[n % d.length]; n = Math.floor(n / d.length); return v; });
    const [columns, header, headingStyle, datePlacement, skillsStyle, photo] = pick as [
      LayoutSpec["columns"], LayoutSpec["header"], LayoutSpec["headingStyle"], LayoutSpec["datePlacement"], LayoutSpec["skillsStyle"], LayoutSpec["photo"]];
    yield { columns, header, headingStyle, datePlacement, skillsStyle, photo, sidebarSections: columns === "single" ? [] : SIDEBAR_SETS[i % SIDEBAR_SETS.length]! };
  }
}

const HEADER_NAMES: Record<LayoutSpec["header"], string> = { left: "Line", centered: "Centre", banner: "Banner", split: "Split", boxed: "Frame" };
const COLUMN_NAMES: Record<LayoutSpec["columns"], string> = { single: "", sidebar_start: "Sidebar", sidebar_end: "Aside" };

function buildLibrary(): TemplateSpec[] {
  const seen = new Set<string>();
  const out: TemplateSpec[] = [];
  for (const cat of TEMPLATE_CATEGORIES) {
    const r = RULES[cat];
    let n = 0;
    for (const layout of combos(r)) {
      if (n >= PER_CATEGORY) break;
      const key = layoutKey(layout);
      if (seen.has(key)) continue;
      seen.add(key);
      const twoCol = layout.columns !== "single";
      out.push(TemplateSpec.parse({
        id: `${cat.replace(/_/g, "-")}-${String(n + 1).padStart(2, "0")}`,
        name: [r.label, COLUMN_NAMES[layout.columns], HEADER_NAMES[layout.header]].filter(Boolean).join(" "),
        category: cat,
        layout,
        typography: { fontStack: r.fonts[n % r.fonts.length], baseSizePt: layout.columns === "single" ? 10.5 : 10, lineHeight: 1.35 },
        spacing: r.spacing[n % r.spacing.length],
        accent: r.accents[n % r.accents.length],
        premium: n >= r.premiumFrom,
        ats: { columns: twoCol ? 2 : 1, usesTables: false, usesIconsForText: false, usesGraphicsForSkills: false, headingsAreText: true },
        supportsRtl: true,
        supportsDocx: true,
        accessibility: { minContrastRatio: 4.5, semanticHeadings: true, language: "from_document" },
      }));
      n++;
    }
    if (n < PER_CATEGORY) throw new Error(`Category ${cat} cannot produce ${PER_CATEGORY} distinct layouts`);
  }
  return out;
}

export const TEMPLATES: readonly TemplateSpec[] = buildLibrary();
export const getTemplate = (id: string) => TEMPLATES.find((t) => t.id === id);

/** Recommend templates for a country's preferred categories, ATS-safe first when requested. */
export function recommendTemplates(categories: string[], opts: { atsFirst?: boolean; includePremium?: boolean } = {}): TemplateSpec[] {
  const pool = TEMPLATES.filter((t) => opts.includePremium || !t.premium);
  const rank = (t: TemplateSpec) => {
    const ci = categories.indexOf(t.category);
    return (ci < 0 ? 100 : ci) * 10 + (opts.atsFirst && t.ats.columns === 2 ? 5 : 0);
  };
  return [...pool].sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));
}
