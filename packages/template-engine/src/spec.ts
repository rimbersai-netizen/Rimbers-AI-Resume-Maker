import { z } from "zod";
import { SECTION_KEYS } from "@gars/resume-schema";

export const TEMPLATE_CATEGORIES = [
  "ats_minimal", "classic", "modern", "corporate", "executive", "technical", "engineering", "construction", "healthcare",
  "finance", "accounting", "sales", "marketing", "academic", "graduate", "internship", "legal", "hospitality", "creative",
  "government", "international",
] as const;

/** Structural dimensions. Two templates are DISTINCT LAYOUTS only if their `layoutKey` differs (colour never counts). */
export const LayoutSpec = z.object({
  columns: z.enum(["single", "sidebar_start", "sidebar_end"]),
  header: z.enum(["left", "centered", "banner", "split", "boxed"]),
  headingStyle: z.enum(["rule", "underline", "caps_spaced", "block", "side_label"]),
  datePlacement: z.enum(["inline_end", "below_title", "start_column"]),
  skillsStyle: z.enum(["comma", "chips", "grid"]),
  sidebarSections: z.array(z.enum(SECTION_KEYS)).default([]),
  photo: z.enum(["none", "circle", "square"]),
});
export type LayoutSpec = z.infer<typeof LayoutSpec>;

export const TemplateSpec = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/),
  name: z.string().min(1),
  category: z.enum(TEMPLATE_CATEGORIES),
  layout: LayoutSpec,
  typography: z.object({
    fontStack: z.enum(["sans", "serif", "humanist", "mono_accent"]),
    baseSizePt: z.number().min(9).max(12),
    lineHeight: z.number().min(1.15).max(1.7),
  }),
  spacing: z.enum(["compact", "normal", "airy"]),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  premium: z.boolean().default(false),
  /** Declared ATS traits; verified by tests against the rendered HTML. */
  ats: z.object({ columns: z.union([z.literal(1), z.literal(2)]), usesTables: z.literal(false), usesIconsForText: z.boolean(), usesGraphicsForSkills: z.boolean(), headingsAreText: z.literal(true) }),
  supportsRtl: z.literal(true),
  supportsDocx: z.literal(true),
  accessibility: z.object({ minContrastRatio: z.number().min(4.5), semanticHeadings: z.literal(true), language: z.literal("from_document") }),
});
export type TemplateSpec = z.infer<typeof TemplateSpec>;

export function layoutKey(l: LayoutSpec): string {
  return [l.columns, l.header, l.headingStyle, l.datePlacement, l.skillsStyle, l.photo].join("|");
}
