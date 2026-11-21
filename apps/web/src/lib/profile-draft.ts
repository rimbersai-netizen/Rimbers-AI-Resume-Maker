/**
 * Pure master-profile draft logic shared by the builder UI and server actions (no React, no Supabase).
 */
import { MasterProfile } from "@gars/resume-schema";
import { validateMasterProfile, type FieldIssue } from "@gars/validation";

export type Draft = MasterProfile;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const newId = (): string => globalThis.crypto.randomUUID();

/** An empty draft. Not schema-valid until a name is entered — drafts may be incomplete. */
export function emptyDraft(): Draft {
  const base = MasterProfile.parse({ schemaVersion: 1, personal: { fullName: "placeholder" } });
  return { ...base, personal: { fullName: "", location: {} } };
}

/**
 * Turn anything loaded (server row, local storage, version snapshot) into a complete Draft shape,
 * even when it is not schema-valid yet (e.g. a new profile with an empty name).
 */
export function toDraft(raw: unknown): Draft {
  const parsed = MasterProfile.safeParse(raw);
  if (parsed.success) return parsed.data;
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Draft>;
  const base = emptyDraft();
  const arr = <K extends keyof Draft>(k: K) => (Array.isArray(r[k]) ? r[k] : base[k]) as Draft[K];
  return {
    ...base,
    summary: typeof r.summary === "string" ? r.summary : undefined,
    personal: { ...base.personal, ...(r.personal ?? {}), fullName: r.personal?.fullName ?? "", location: { ...(r.personal?.location ?? {}) } },
    experience: arr("experience").map((w) => ({ ...w, dates: { ...(w.dates ?? {}), current: w.dates?.current ?? false }, bullets: w.bullets ?? [] })),
    education: arr("education").map((e) => ({ ...e, dates: { ...(e.dates ?? {}), current: e.dates?.current ?? false } })),
    skills: arr("skills"), certifications: arr("certifications"), languages: arr("languages"), projects: arr("projects"),
    publications: arr("publications"), awards: arr("awards"), volunteer: arr("volunteer"), references: arr("references"),
    customSections: arr("customSections"),
  };
}

/** Remove "" / whitespace-only / undefined values so optional fields validate as absent (forms emit ""). */
export function cleanEmpty<T>(value: T): T {
  if (Array.isArray(value)) return value.map(cleanEmpty) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined || (typeof v === "string" && v.trim() === "")) continue;
      out[k] = typeof v === "string" ? v.trim() : cleanEmpty(v);
    }
    return out as T;
  }
  return value;
}

/** DB-backed collections need uuid ids; anything else (imported/legacy ids) gets a fresh uuid. */
export function normalizeIds(d: Draft): Draft {
  const fix = <T extends { id: string }>(xs: T[]) => xs.map((x) => (UUID.test(x.id) ? x : { ...x, id: newId() }));
  return {
    ...d,
    experience: fix(d.experience).map((w) => ({ ...w, bullets: w.bullets.filter((b) => b.text.trim() !== "") })),
    education: fix(d.education), skills: fix(d.skills), certifications: fix(d.certifications),
    languages: fix(d.languages), projects: fix(d.projects),
  };
}

export type Issues = Record<string, string>;

/** Prepare a draft for saving. Returns the clean profile or field issues keyed by path ("experience.0.title"). */
export function prepareForSave(draft: unknown): { ok: true; profile: Draft } | { ok: false; issues: Issues } {
  // Drop blank bullets BEFORE cleaning, otherwise cleanEmpty strips `text` and the bullet fails validation.
  const d = draft as Draft;
  const noBlankBullets = { ...d, experience: (d.experience ?? []).map((w) => ({ ...w, bullets: (w.bullets ?? []).filter((b) => b.text?.trim()) })) };
  const cleaned = cleanEmpty(noBlankBullets) as Draft;
  const withDefaults = { ...cleaned, personal: { ...cleaned.personal, location: cleaned.personal?.location ?? {} } };
  const r = validateMasterProfile(withDefaults);
  if (!r.ok) return { ok: false, issues: toIssues(r.error) };
  return { ok: true, profile: normalizeIds(r.value) };
}

function toIssues(list: FieldIssue[]): Issues {
  const out: Issues = {};
  for (const i of list) out[i.path] ??= friendly(i.message);
  return out;
}
function friendly(m: string): string {
  if (/at least 1 character/i.test(m)) return "Required";
  if (/Invalid url/i.test(m)) return "Enter a full link starting with https://";
  if (/Invalid email/i.test(m)) return "Enter a valid email address";
  return m;
}

// ---------------------------------------------------------------- local recovery
export interface LocalDraft {
  profileId: string;
  draft: Draft;
  /** updatedAt of the server version this draft was based on. */
  baseUpdatedAt: string;
  savedAt: string;
}

export type RecoveryDecision = "none" | "restore" | "restore_conflict";

/**
 * After a crash/close, should we offer to restore unsaved local edits?
 * - none: no local draft, or it equals the server copy.
 * - restore: edits were made on top of the current server version.
 * - restore_conflict: the server changed since (other device) — offer, but warn it will overwrite.
 */
export function recoveryDecision(local: LocalDraft | null, server: { id: string; updatedAt: string; profile: Draft }): RecoveryDecision {
  if (!local || local.profileId !== server.id) return "none";
  if (stableJson(cleanEmpty(local.draft)) === stableJson(cleanEmpty(server.profile))) return "none";
  return local.baseUpdatedAt === server.updatedAt ? "restore" : "restore_conflict";
}

export function stableJson(v: unknown): string {
  return JSON.stringify(v, (_k, val) =>
    val && typeof val === "object" && !Array.isArray(val)
      ? Object.fromEntries(Object.entries(val as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : val);
}

// ---------------------------------------------------------------- stepper
export const STEPS = ["personal", "experience", "education", "skills", "review"] as const;
export type Step = (typeof STEPS)[number];

export function stepComplete(d: Draft, step: Step): boolean {
  switch (step) {
    case "personal": return d.personal.fullName.trim() !== "" && Boolean(d.personal.email);
    case "experience": return d.experience.length > 0 && d.experience.every((w) => w.employer && w.title);
    case "education": return d.education.length > 0;
    case "skills": return d.skills.length >= 3;
    case "review": return STEPS.slice(0, 4).every((s) => stepComplete(d, s));
  }
}

/** Issues belonging to a step (for badges / blocking "Continue"). */
export function issuesForStep(issues: Issues, step: Step): string[] {
  const prefix: Record<Step, string[]> = {
    personal: ["personal", "summary"], experience: ["experience"], education: ["education"],
    skills: ["skills", "languages", "certifications", "projects"], review: [],
  };
  return Object.keys(issues).filter((k) => prefix[step].some((p) => k === p || k.startsWith(`${p}.`)));
}

export function move<T>(xs: T[], from: number, to: number): T[] {
  if (to < 0 || to >= xs.length) return xs;
  const copy = [...xs];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item!);
  return copy;
}
