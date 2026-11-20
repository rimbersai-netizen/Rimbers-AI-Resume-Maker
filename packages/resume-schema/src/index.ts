/**
 * Canonical data contract for master profiles and resume documents.
 * Web, mobile, workers and edge functions MUST validate through these schemas.
 */
import { z } from "zod";
import { SUPPORTED_LOCALES } from "@gars/shared-types";

/** Partial ISO date: YYYY or YYYY-MM or YYYY-MM-DD. Resumes often only know month precision. */
export const PartialDate = z
  .string()
  .regex(/^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/, "Expected YYYY, YYYY-MM or YYYY-MM-DD");
export type PartialDate = z.infer<typeof PartialDate>;

const Id = z.string().min(1).max(64);
const ShortText = z.string().trim().max(200);
const LongText = z.string().trim().max(5000);
const Url = z.string().url().max(500);

/** Where a value came from — used for factual traceability of AI suggestions. */
export const Provenance = z.enum(["user", "import", "ai_accepted"]);

export const DateRange = z
  .object({
    start: PartialDate.optional(),
    end: PartialDate.optional(),
    current: z.boolean().default(false),
  })
  .refine((r) => !(r.current && r.end), { message: "A current role cannot have an end date", path: ["end"] })
  .refine((r) => !r.start || !r.end || r.start <= r.end.padEnd(r.start.length, "9"), {
    message: "End date must not be before start date",
    path: ["end"],
  });

export const PersonalDetails = z.object({
  fullName: ShortText.min(1),
  professionalTitle: ShortText.optional(),
  email: z.string().email().max(254).optional(),
  phone: z.string().max(40).optional(),
  location: z.object({ city: ShortText.optional(), region: ShortText.optional(), country: z.string().length(2).optional() }).default({}),
  linkedin: Url.optional(),
  website: Url.optional(),
  portfolio: Url.optional(),
  /** Storage path in a private bucket — never a public URL. Optional by design. */
  photoPath: z.string().max(300).optional(),
  workAuthorization: ShortText.optional(),
});

export const WorkExperience = z.object({
  id: Id,
  employer: ShortText.min(1),
  title: ShortText.min(1),
  location: ShortText.optional(),
  dates: DateRange,
  description: LongText.optional(),
  /** Each bullet keeps provenance so AI rewrites can be audited. */
  bullets: z.array(z.object({ id: Id, text: z.string().trim().min(1).max(600), provenance: Provenance.default("user") })).default([]),
});

export const Education = z.object({
  id: Id,
  institution: ShortText.min(1),
  qualification: ShortText.min(1),
  field: ShortText.optional(),
  dates: DateRange,
  grade: ShortText.optional(),
  notes: LongText.optional(),
});

export const Skill = z.object({
  id: Id,
  name: ShortText.min(1),
  category: ShortText.optional(),
  level: z.enum(["beginner", "intermediate", "advanced", "expert"]).optional(),
});

export const Certification = z.object({
  id: Id,
  name: ShortText.min(1),
  issuer: ShortText.optional(),
  issued: PartialDate.optional(),
  expires: PartialDate.optional(),
  credentialUrl: Url.optional(),
});

export const LanguageSkill = z.object({
  id: Id,
  language: ShortText.min(1),
  /** CEFR where known, otherwise descriptive. */
  proficiency: z.enum(["A1", "A2", "B1", "B2", "C1", "C2", "native"]).optional(),
});

export const Project = z.object({
  id: Id,
  name: ShortText.min(1),
  role: ShortText.optional(),
  dates: DateRange.optional(),
  description: LongText.optional(),
  url: Url.optional(),
});

/** Generic dated entry for publications, awards, volunteer work, references, custom sections. */
export const GenericEntry = z.object({
  id: Id,
  title: ShortText.min(1),
  subtitle: ShortText.optional(),
  date: PartialDate.optional(),
  description: LongText.optional(),
  url: Url.optional(),
});

export const CustomSection = z.object({ id: Id, heading: ShortText.min(1), entries: z.array(GenericEntry).default([]) });

export const MasterProfile = z.object({
  schemaVersion: z.literal(1),
  personal: PersonalDetails,
  summary: LongText.optional(),
  experience: z.array(WorkExperience).default([]),
  education: z.array(Education).default([]),
  skills: z.array(Skill).default([]),
  certifications: z.array(Certification).default([]),
  languages: z.array(LanguageSkill).default([]),
  projects: z.array(Project).default([]),
  publications: z.array(GenericEntry).default([]),
  awards: z.array(GenericEntry).default([]),
  volunteer: z.array(GenericEntry).default([]),
  references: z.array(GenericEntry).default([]),
  customSections: z.array(CustomSection).default([]),
});
export type MasterProfile = z.infer<typeof MasterProfile>;

export const SECTION_KEYS = [
  "summary", "experience", "education", "skills", "certifications", "languages",
  "projects", "publications", "awards", "volunteer", "references", "custom",
] as const;
export const SectionKey = z.enum(SECTION_KEYS);
export type SectionKey = z.infer<typeof SectionKey>;

/** A resume version: a projection of the master profile with presentation choices. */
export const ResumeDocument = z.object({
  schemaVersion: z.literal(1),
  id: Id,
  title: ShortText.min(1),
  country: z.string().length(2),
  locale: z.enum(SUPPORTED_LOCALES),
  templateId: Id,
  pageSize: z.enum(["A4", "Letter"]),
  sectionOrder: z.array(SectionKey).min(1),
  hiddenItemIds: z.array(Id).default([]),
  includePhoto: z.boolean().default(false),
  targetJobDescriptionId: Id.optional(),
  profile: MasterProfile,
});
export type ResumeDocument = z.infer<typeof ResumeDocument>;

export function parseMasterProfile(input: unknown) {
  return MasterProfile.safeParse(input);
}
export function parseResumeDocument(input: unknown) {
  return ResumeDocument.safeParse(input);
}
