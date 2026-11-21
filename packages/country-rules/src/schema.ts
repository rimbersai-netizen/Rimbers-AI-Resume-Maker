import { z } from "zod";
import { SECTION_KEYS } from "@gars/resume-schema";

/**
 * Country resume conventions. These are HIRING CONVENTIONS, not legal requirements:
 * every value is a recommendation the user can override.
 */
export const Visibility = z.enum([
  "omit",        // usually left out; including it may hurt (e.g. photo in US)
  "optional",    // neutral; user's choice
  "common",      // frequently included
  "expected",    // most employers expect it (still never forced)
]);
export type Visibility = z.infer<typeof Visibility>;

export const DateFormat = z.enum(["MM/YYYY", "MM.YYYY", "MMM YYYY", "YYYY-MM", "YYYY年MM月", "YYYY.MM"]);
export type DateFormat = z.infer<typeof DateFormat>;

export const ReviewStatus = z.enum(["unreviewed", "editorial", "expert_reviewed"]);

export const Source = z.object({
  title: z.string().min(1),
  url: z.string().url().regex(/^https:\/\//),
  kind: z.enum(["government", "intergovernmental", "career_service", "editorial"]),
});

export const CountryRule = z.object({
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  name: z.string().min(1),
  /** Resume languages commonly accepted, most common first. A SUGGESTION ONLY — never sets app language. */
  suggestedResumeLocales: z.array(z.string().regex(/^[a-z]{2}(-[A-Za-z]+)?$/)).min(1),
  pageSize: z.enum(["A4", "Letter"]),
  typicalPages: z.object({ min: z.number().int().min(1), max: z.number().int().min(1) })
    .refine((p) => p.max >= p.min, "max < min"),
  documentName: z.enum(["resume", "cv"]),
  dateFormat: DateFormat,
  sectionOrder: z.array(z.enum(SECTION_KEYS)).min(4),
  photo: Visibility,
  personalInfo: z.object({
    dateOfBirth: Visibility,
    nationality: Visibility,
    maritalStatus: Visibility,
    gender: Visibility,
    visaOrWorkStatus: Visibility,
    fullAddress: Visibility,
  }),
  /** Template categories that suit local norms, most suitable first. */
  recommendedTemplateCategories: z.array(z.string()).min(1),
  notes: z.array(z.string()).default([]),
  sources: z.array(Source).min(1),
  reviewStatus: ReviewStatus,
  lastReviewed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type CountryRule = z.infer<typeof CountryRule>;
export type CountryRuleInput = z.input<typeof CountryRule>;
