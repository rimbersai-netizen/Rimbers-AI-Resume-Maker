/** Field-level validation and sanitization shared by forms (web/mobile) and server code. */
import type { MasterProfile } from "@gars/resume-schema";
import { MasterProfile as MasterProfileSchema } from "@gars/resume-schema";
import { err, ok, type Result } from "@gars/shared-types";

/** Lenient international phone check: digits, spaces, +, -, (), 7–15 digits total (E.164 max). */
export function isPlausiblePhone(input: string): boolean {
  if (!/^[+(\d][\d\s\-().]*$/.test(input.trim())) return false;
  const digits = input.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

/** Only http(s) links are allowed in documents — blocks javascript:, data:, file: etc. */
export function isSafeHttpUrl(input: string): boolean {
  try {
    const u = new URL(input);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** Strip control chars (keep \n and \t) and normalize Unicode so RTL/CJK text compares consistently. */
export function sanitizeText(input: string): string {
  // eslint-disable-next-line no-control-regex
  return input.normalize("NFC").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
}

export interface FieldIssue {
  path: string;
  message: string;
}

/** Validate a master profile and add cross-field checks the schema cannot express. */
export function validateMasterProfile(input: unknown): Result<MasterProfile, FieldIssue[]> {
  const parsed = MasterProfileSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  }
  const p = parsed.data;
  const issues: FieldIssue[] = [];
  if (p.personal.phone && !isPlausiblePhone(p.personal.phone)) {
    issues.push({ path: "personal.phone", message: "Phone number looks invalid" });
  }
  for (const key of ["linkedin", "website", "portfolio"] as const) {
    const v = p.personal[key];
    if (v && !isSafeHttpUrl(v)) issues.push({ path: `personal.${key}`, message: "Only http(s) links are allowed" });
  }
  const ids = new Set<string>();
  const collections = [p.experience, p.education, p.skills, p.certifications, p.languages, p.projects,
    p.publications, p.awards, p.volunteer, p.references, p.customSections];
  for (const col of collections) {
    for (const item of col) {
      if (ids.has(item.id)) issues.push({ path: item.id, message: `Duplicate item id "${item.id}"` });
      ids.add(item.id);
    }
  }
  return issues.length ? err(issues) : ok(p);
}
