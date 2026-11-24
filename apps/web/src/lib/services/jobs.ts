import type { SupabaseClient, User } from "@supabase/supabase-js";
import { z } from "zod";
import { scoreJob, tailorPlan, skillLabel, type JobMatch, type TailorPlan } from "@gars/ats-engine";
import { AiJobOutput } from "@gars/ai-engine";
import { loadPrimaryProfileCore, saveProfileCore } from "./profile";
import { createResumeCore, type ActionResult } from "./resumes";
import { requestAi } from "./ai";
import { defaultLayout } from "../resume-settings";
import { newId } from "../profile-draft";

/* ------------------------------------------------------------------ job model */

export type WorkMode = "remote" | "hybrid" | "onsite" | "unknown";
export interface Job {
  key: string; // `${source}:${externalId}`
  source: "remotive" | "arbeitnow";
  externalId: string;
  title: string;
  company: string;
  logo?: string;
  location: string;
  workMode: WorkMode;
  jobType?: string;
  salaryText?: string;
  salaryMin?: number;
  postedAt: string;
  url: string;
  tags: string[];
  /** Plain text, trimmed. */
  description: string;
}

export const ROLES = {
  engineer: { label: "Engineer", hint: "Software, hardware, infrastructure", re: /engineer|developer|devops|sre|software|programmer|architect|backend|frontend|full[- ]?stack|mobile|qa\b|tester/i },
  designer: { label: "Designer", hint: "Product, UX, brand", re: /design|ux\b|ui\b|creative|illustrat|brand/i },
  product: { label: "Product", hint: "PM, strategy, operations", re: /product (manager|owner|lead|analyst)|program manager|strategy|\bpm\b/i },
  marketing: { label: "Marketing", hint: "Growth, content, brand", re: /marketing|growth|seo|content|social media|copywrit|community|brand/i },
  data: { label: "Data", hint: "Analytics, ML, science", re: /data|analytics|machine learning|\bml\b|\bai\b|scientist|bi\b|statistic/i },
  sales: { label: "Sales", hint: "Sales, partnerships, accounts", re: /sales|account (executive|manager)|business development|partnership|customer success/i },
  finance: { label: "Finance", hint: "Accounting, FP&A, audit", re: /financ|account(ant|ing)|audit|payroll|controller|bookkeep/i },
  operations: { label: "Operations", hint: "Ops, logistics, admin", re: /operations|logistics|supply|admin|coordinator|procurement/i },
  support: { label: "Support", hint: "Customer support and success", re: /support|customer (service|care|success)|help ?desk/i },
  people: { label: "People & HR", hint: "Recruiting, HR", re: /recruit|talent|human resources|\bhr\b|people (ops|partner)/i },
} as const;
export type RoleId = keyof typeof ROLES;
export const ROLE_IDS = Object.keys(ROLES) as RoleId[];

export const PrefsSchema = z.object({
  roles: z.array(z.enum(ROLE_IDS as [RoleId, ...RoleId[]])).max(20).default([]),
  workModes: z.array(z.enum(["remote", "hybrid", "onsite"])).max(3).default([]),
  countries: z.array(z.string().regex(/^[A-Z]{2}$/)).max(20).default([]),
  minSalary: z.number().int().min(0).max(10_000_000).nullable().default(null),
  postedWithinDays: z.union([z.literal(1), z.literal(3), z.literal(7), z.literal(14), z.literal(30)]).nullable().default(null),
});
export type Prefs = z.infer<typeof PrefsSchema>;

/* ------------------------------------------------------------------ feeds (public sources, cached server-side) */

const TTL_MS = 6 * 60 * 60 * 1000; // Remotive asks API users to poll sparingly (≈ 4 calls/day)
const cache = new Map<string, { at: number; jobs: Job[] }>();

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", hellip: "…", bull: "•" };
function stripOnce(html: string): string {
  return html
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, " ")
    .replace(/<\s*br\s*\/?>|<\/\s*(p|div|h[1-6]|ul|ol|tr)\s*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "\n• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") { const n = e[1]?.toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ""; }
      return ENT[e.toLowerCase()] ?? m;
    })
    .replace(/[ \t ]+/g, " ").replace(/\s*\n\s*/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Some feeds HTML-encode their HTML ("&lt;p&gt;"): decode once, and if tags appear, strip again. */
export function htmlToText(html: string): string {
  const once = stripOnce(html);
  return /<\/?[a-z][^>]*>/i.test(once) ? stripOnce(once) : once;
}

export function parseSalaryMin(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const m = /(\d{1,3}(?:[,.]\d{3})+|\d+(?:\.\d+)?)\s*(k)?/i.exec(text.replace(/\s/g, ""));
  if (!m) return undefined;
  let n = Number(m[1]!.replace(/,/g, ""));
  if (m[2]) n *= 1000;
  return Number.isFinite(n) && n >= 1000 ? Math.round(n) : undefined;
}

const safeUrl = (u: unknown): string | undefined => (typeof u === "string" && /^https?:\/\//i.test(u) ? u : undefined);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "GlobalAIResumeStudio/1.0" }, signal: AbortSignal.timeout(20_000), cache: "no-store" });
  if (!res.ok) throw new Error(`feed ${res.status}`);
  return res.json();
}

async function loadRemotive(): Promise<Job[]> {
  const raw = (await fetchJson("https://remotive.com/api/remote-jobs?limit=250")) as { jobs?: Record<string, unknown>[] };
  return (raw.jobs ?? []).flatMap((j) => {
    const url = safeUrl(j.url), id = String(j.id ?? ""), title = str(j.title, 300);
    if (!url || !id || !title) return [];
    const salaryText = str(j.salary, 120) || undefined;
    return [{
      key: `remotive:${id}`, source: "remotive" as const, externalId: id, title, company: str(j.company_name, 200) || "Company",
      logo: safeUrl(j.company_logo), location: str(j.candidate_required_location, 120) || "Worldwide", workMode: "remote" as const,
      jobType: str(j.job_type, 40).replace(/_/g, " ") || undefined, salaryText, salaryMin: parseSalaryMin(salaryText),
      postedAt: new Date(str(j.publication_date, 40) || Date.now()).toISOString(), url,
      tags: Array.isArray(j.tags) ? j.tags.filter((t): t is string => typeof t === "string").slice(0, 12) : [],
      description: htmlToText(str(j.description, 60000)).slice(0, 6000),
    }];
  });
}

async function loadArbeitnow(): Promise<Job[]> {
  const raw = (await fetchJson("https://www.arbeitnow.com/api/job-board-api")) as { data?: Record<string, unknown>[] };
  return (raw.data ?? []).flatMap((j) => {
    const url = safeUrl(j.url), id = String(j.slug ?? ""), title = str(j.title, 300);
    if (!url || !id || !title) return [];
    const types = Array.isArray(j.job_types) ? j.job_types.filter((t): t is string => typeof t === "string") : [];
    const created = typeof j.created_at === "number" ? j.created_at * 1000 : Date.now();
    return [{
      key: `arbeitnow:${id}`, source: "arbeitnow" as const, externalId: id, title, company: str(j.company_name, 200) || "Company",
      location: str(j.location, 120) || (j.remote ? "Remote" : "—"), workMode: j.remote ? ("remote" as const) : ("onsite" as const),
      jobType: types[0], postedAt: new Date(created).toISOString(), url,
      tags: Array.isArray(j.tags) ? j.tags.filter((t): t is string => typeof t === "string").slice(0, 12) : [],
      description: htmlToText(str(j.description, 60000)).slice(0, 6000),
    }];
  });
}

const DE_WORDS = /\b(und|der|die|das|mit|für|wir|sie|ist|nicht|oder|auf|bei|werden|deine|dein|ihre|unser|unsere|aufgaben|bieten|erfahrung|kenntnisse|sowie|zum|zur|eine|einen|dich|deinen|bist|suchen)\b/gi;
/** Listings are shown in English for now: drop postings written in German (Arbeitnow is mostly German). */
export function looksGerman(text: string): boolean {
  if (/\((m\/w\/d|w\/m\/d|m\/f\/d|f\/m\/d|d\/m\/w)\)/i.test(text)) return true;
  const words = text.split(/\s+/).filter(Boolean).length;
  return words >= 15 && (text.match(DE_WORDS)?.length ?? 0) / words > 0.06;
}

const SOURCES: Record<string, () => Promise<Job[]>> = { remotive: loadRemotive, arbeitnow: loadArbeitnow };

/** All current listings. A failing source falls back to its last good copy; only if every source fails do we report it. */
export async function loadAllJobs(): Promise<{ jobs: Job[]; degraded: string[] }> {
  const degraded: string[] = [];
  const results = await Promise.all(Object.entries(SOURCES).map(async ([name, load]) => {
    const hit = cache.get(name);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.jobs;
    try {
      const jobs = await load();
      cache.set(name, { at: Date.now(), jobs });
      return jobs;
    } catch {
      degraded.push(name);
      return hit?.jobs ?? [];
    }
  }));
  const jobs = results.flat().filter((j) => !looksGerman(`${j.title}. ${j.description.slice(0, 1500)}`));
  if (!jobs.length && degraded.length === Object.keys(SOURCES).length) throw new Error("Job sources are unreachable right now.");
  return { jobs, degraded };
}

/** Test hook. */
export function _setJobCache(name: string, jobs: Job[]) { cache.set(name, { at: Date.now(), jobs }); }

/* ------------------------------------------------------------------ preferences */

const DEFAULT_PREFS: Prefs = { roles: [], workModes: [], countries: [], minSalary: null, postedWithinDays: null };

export async function getPrefs(supabase: SupabaseClient): Promise<{ prefs: Prefs; saved: boolean }> {
  const { data } = await supabase.from("job_preferences").select("roles,work_modes,countries,min_salary,posted_within_days").maybeSingle();
  if (!data) return { prefs: DEFAULT_PREFS, saved: false };
  const parsed = PrefsSchema.safeParse({ roles: data.roles, workModes: data.work_modes, countries: data.countries, minSalary: data.min_salary, postedWithinDays: data.posted_within_days });
  return { prefs: parsed.success ? parsed.data : DEFAULT_PREFS, saved: true };
}

export async function savePrefs(supabase: SupabaseClient, user: User, input: unknown): Promise<ActionResult<{ prefs: Prefs }>> {
  const p = PrefsSchema.safeParse(input);
  if (!p.success) return { ok: false, kind: "invalid", message: "Those preferences are not valid." };
  const { error } = await supabase.from("job_preferences").upsert({
    user_id: user.id, roles: p.data.roles, work_modes: p.data.workModes, countries: p.data.countries, min_salary: p.data.minSalary, posted_within_days: p.data.postedWithinDays,
  });
  return error ? { ok: false, kind: "error", message: "Could not save your preferences." } : { ok: true, value: { prefs: p.data } };
}

/* ------------------------------------------------------------------ feed */

export interface ScoredJob extends Job { match: Pick<JobMatch, "score" | "label" | "matched" | "missing" | "requiredYears" | "profileYears"> }

export function passesPrefs(j: Job, prefs: Prefs, now = Date.now()): boolean {
  if (prefs.roles.length && !prefs.roles.some((r) => ROLES[r].re.test(`${j.title} ${j.tags.join(" ")}`))) return false;
  if (prefs.workModes.length && j.workMode !== "unknown" && !prefs.workModes.includes(j.workMode)) return false;
  if (prefs.minSalary != null && j.salaryMin != null && j.salaryMin < prefs.minSalary) return false; // unknown salary is kept, not hidden
  if (prefs.postedWithinDays != null && now - new Date(j.postedAt).getTime() > prefs.postedWithinDays * 86_400_000) return false;
  return true;
}

const slim = (m: JobMatch): ScoredJob["match"] => ({ score: m.score, label: m.label, matched: m.matched.slice(0, 12), missing: m.missing.slice(0, 12), requiredYears: m.requiredYears, profileYears: m.profileYears });

export async function getFeed(supabase: SupabaseClient, user: User, opts: { offset?: number; limit?: number } = {}) {
  const [{ prefs, saved }, profile, { jobs, degraded }, seen] = await Promise.all([
    getPrefs(supabase),
    loadPrimaryProfileCore(supabase, user),
    loadAllJobs(),
    supabase.from("job_pipeline").select("source,external_id"),
  ]);
  const done = new Set((seen.data ?? []).map((r) => `${r.source}:${r.external_id}`));
  const profileReady = Boolean(profile && (profile.profile.experience.length || profile.profile.skills.length));
  const pool = jobs.filter((j) => !done.has(j.key) && passesPrefs(j, prefs));
  const scored: ScoredJob[] = pool.map((j) => ({ ...j, match: slim(scoreJob(profile!.profile, j)) }))
    .sort((a, b) => b.match.score - a.match.score || +new Date(b.postedAt) - +new Date(a.postedAt));
  const offset = Math.max(0, opts.offset ?? 0), limit = Math.min(50, Math.max(1, opts.limit ?? 20));
  return { jobs: scored.slice(offset, offset + limit), total: scored.length, prefsSaved: saved, prefs, profileReady, degraded };
}

export async function findJob(key: string): Promise<Job | null> {
  const { jobs } = await loadAllJobs().catch(() => ({ jobs: [] as Job[] }));
  return jobs.find((j) => j.key === key) ?? null;
}

/* ------------------------------------------------------------------ pipeline */

export const STATES = ["saved", "passed", "ready", "applying", "applied", "needs_you", "interview", "offer", "rejected"] as const;
export type PipelineState = (typeof STATES)[number];

export interface PipelineItem {
  id: string; key: string; state: PipelineState; title: string; company: string; url?: string; matchScore?: number;
  logo?: string; location?: string; tailoredResumeId?: string; notes?: string; appliedAt?: string; updatedAt: string;
}

const toItem = (r: Record<string, any>): PipelineItem => ({
  id: r.id, key: `${r.source}:${r.external_id}`, state: r.state, title: r.title, company: r.company, url: r.url ?? undefined,
  matchScore: r.match_score ?? undefined, logo: r.snapshot?.logo, location: r.snapshot?.location, tailoredResumeId: r.tailored_resume_id ?? undefined,
  notes: r.notes ?? undefined, appliedAt: r.applied_at ?? undefined, updatedAt: r.updated_at,
});

export async function listPipeline(supabase: SupabaseClient, states?: PipelineState[]): Promise<PipelineItem[]> {
  let q = supabase.from("job_pipeline").select("id,source,external_id,state,title,company,url,match_score,snapshot,tailored_resume_id,notes,applied_at,updated_at").order("updated_at", { ascending: false }).limit(300);
  q = states?.length ? q.in("state", states) : q.neq("state", "passed");
  const { data } = await q;
  return (data ?? []).map(toItem);
}

const StateInput = z.object({ key: z.string().regex(/^[a-z]+:.{1,200}$/), state: z.enum(STATES), notes: z.string().trim().max(2000).optional() });

/** Save/pass/apply a job. New rows snapshot the listing from the server's own feed copy, never from client-supplied text. */
export async function setJobState(supabase: SupabaseClient, user: User, input: unknown): Promise<ActionResult<{ item: PipelineItem }>> {
  const p = StateInput.safeParse(input);
  if (!p.success) return { ok: false, kind: "invalid", message: "Invalid request." };
  const [source, ...rest] = p.data.key.split(":");
  const externalId = rest.join(":");
  const existing = await supabase.from("job_pipeline").select("id").eq("source", source!).eq("external_id", externalId).maybeSingle();
  const patch: Record<string, unknown> = { state: p.data.state };
  if (p.data.notes !== undefined) patch.notes = p.data.notes;
  if (p.data.state === "applied") patch.applied_at = new Date().toISOString();
  let row;
  if (existing.data) {
    row = await supabase.from("job_pipeline").update(patch).eq("id", existing.data.id).select("*").single();
  } else {
    const job = await findJob(p.data.key);
    if (!job) return { ok: false, kind: "error", message: "That listing is no longer available. Refresh the feed." };
    const profile = await loadPrimaryProfileCore(supabase, user);
    const score = profile ? scoreJob(profile.profile, job).score : null;
    row = await supabase.from("job_pipeline").insert({
      ...patch, user_id: user.id, source: job.source, external_id: job.externalId, title: job.title, company: job.company, url: job.url, match_score: score, snapshot: job,
    }).select("*").single();
  }
  if (row.error || !row.data) return { ok: false, kind: "error", message: "Could not update this job." };
  return { ok: true, value: { item: toItem(row.data) } };
}

export async function removeFromPipeline(supabase: SupabaseClient, id: string): Promise<boolean> {
  if (!z.string().uuid().safeParse(id).success) return false;
  const { error } = await supabase.from("job_pipeline").delete().eq("id", id);
  return !error;
}

export async function getPipelineJob(supabase: SupabaseClient, id: string): Promise<Job | null> {
  if (!z.string().uuid().safeParse(id).success) return null;
  const { data } = await supabase.from("job_pipeline").select("snapshot").eq("id", id).maybeSingle();
  return data?.snapshot && typeof data.snapshot === "object" && (data.snapshot as Job).title ? (data.snapshot as Job) : null;
}

export async function pipelineCounts(supabase: SupabaseClient): Promise<Record<string, number>> {
  const { data } = await supabase.from("job_pipeline").select("state");
  const out: Record<string, number> = {};
  for (const r of data ?? []) out[r.state] = (out[r.state] ?? 0) + 1;
  return out;
}

/* ------------------------------------------------------------------ tailoring */

async function resolveJob(supabase: SupabaseClient, key: string): Promise<Job | null> {
  return (await findJob(key)) ?? null;
}

export async function tailorAnalysis(supabase: SupabaseClient, user: User, key: string): Promise<ActionResult<{ job: Job; plan: TailorPlan; match: ScoredJob["match"] }>> {
  const job = (await resolveJob(supabase, key)) ?? (await (async () => {
    const [s, ...r] = key.split(":");
    const { data } = await supabase.from("job_pipeline").select("snapshot").eq("source", s!).eq("external_id", r.join(":")).maybeSingle();
    return (data?.snapshot as Job | undefined) ?? null;
  })());
  if (!job) return { ok: false, kind: "error", message: "That listing is no longer available." };
  const profile = await loadPrimaryProfileCore(supabase, user);
  if (!profile) return { ok: false, kind: "error", message: "Could not load your profile." };
  return { ok: true, value: { job, plan: tailorPlan(profile.profile, job), match: slim(scoreJob(profile.profile, job)) } };
}

const ApplyInput = z.object({
  key: z.string().regex(/^[a-z]+:.{1,200}$/),
  /** Canonical skill ids the user ticked. Gaps need the user's confirmation that they really have the skill. */
  addSkills: z.array(z.string().max(60)).max(30).default([]),
  tailorSummary: z.boolean().default(true),
});

/**
 * "Apply selected": add the skills the user confirmed (only ones from the server-computed plan), create a resume for this role,
 * and queue the fact-checked AI summary. Nothing is added that the user did not tick, nothing is invented.
 */
export async function applyTailoring(supabase: SupabaseClient, user: User, input: unknown): Promise<ActionResult<{ resumeId: string; aiJobId?: string; added: string[]; aiMessage?: string }>> {
  const p = ApplyInput.safeParse(input);
  if (!p.success) return { ok: false, kind: "invalid", message: "Invalid request." };
  const analysis = await tailorAnalysis(supabase, user, p.data.key);
  if (!analysis.ok) return analysis;
  const { job, plan } = analysis.value;
  const allowed = new Map([...plan.optimizations, ...plan.gaps].map((s) => [s.skill, s.label]));
  const bad = p.data.addSkills.filter((s) => !allowed.has(s));
  if (bad.length) return { ok: false, kind: "invalid", message: "One of the selected skills is not part of this plan. Refresh and try again." };

  const loaded = await loadPrimaryProfileCore(supabase, user);
  if (!loaded) return { ok: false, kind: "error", message: "Could not load your profile." };
  const have = new Set(loaded.profile.skills.map((s) => s.name.toLowerCase()));
  const toAdd = p.data.addSkills.map((s) => allowed.get(s)!).filter((label) => !have.has(label.toLowerCase()));
  if (toAdd.length) {
    const next = { ...loaded.profile, skills: [...loaded.profile.skills, ...toAdd.map((name) => ({ id: newId(), name }))] };
    const saved = await saveProfileCore(supabase, loaded.id, next, loaded.updatedAt, `Before tailoring for ${job.title} at ${job.company}`);
    if (!saved.ok) return { ok: false, kind: saved.kind === "conflict" ? "conflict" : saved.kind === "invalid" ? "invalid" : "error", message: saved.kind === "conflict" ? "Your profile changed on another device. Reload and try again." : "Could not update your profile." };
    await supabase.rpc("write_audit_log", { p_action: "profile.skills_added_for_job", p_entity_type: "profile", p_entity_id: loaded.id, p_metadata: { skills: toAdd, source: "user_confirmed", job: job.key } });
  }

  // Layout for the new resume: reuse the user's latest resume settings so country/language conventions stay consistent.
  const { data: last } = await supabase.from("resume_documents").select("country_code,locale,page_size,include_photo").is("deleted_at", null).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  const country = (last?.country_code ?? loaded.profile.personal.location.country ?? "US").toUpperCase();
  const layout = defaultLayout(/^[A-Z]{2}$/.test(country) ? country : "US", last?.locale ?? "en", { title: `${job.title} — ${job.company}`.slice(0, 200), premiumAllowed: false, hasPhoto: false });
  const created = await createResumeCore(supabase, user, layout);
  if (!created.ok) return created;

  await supabase.from("job_pipeline").update({ tailored_resume_id: created.value.id }).eq("source", job.source).eq("external_id", job.externalId);

  let aiJobId: string | undefined, aiMessage: string | undefined;
  if (p.data.tailorSummary && job.description.length >= 30) {
    const ai = await requestAi(supabase, user, { kind: "tailor_resume", masterProfileId: loaded.id, jobDescription: `${job.title}\n${job.description}`.slice(0, 20000), tone: "professional", locale: layout.locale, targetRole: job.title.slice(0, 120) });
    if (ai.ok) aiJobId = ai.jobId; else aiMessage = ai.message;
  }
  return { ok: true, value: { resumeId: created.value.id, aiJobId, added: toAdd, aiMessage } };
}

/** When the tailoring AI job has finished, store its (already fact-checked) summary on that resume only. */
export async function finishTailoring(supabase: SupabaseClient, resumeId: string, aiJobId: string): Promise<ActionResult<{ summary: string }>> {
  if (!z.string().uuid().safeParse(resumeId).success || !z.string().uuid().safeParse(aiJobId).success) return { ok: false, kind: "invalid", message: "Invalid request." };
  const { data: job } = await supabase.from("ai_jobs").select("status,output").eq("id", aiJobId).maybeSingle();
  if (job?.status !== "succeeded") return { ok: false, kind: "error", message: "The summary is not ready yet." };
  const out = AiJobOutput.safeParse(job.output);
  if (!out.success || out.data.kind !== "tailored_summary") return { ok: false, kind: "error", message: "The AI result could not be used." };
  const { data: doc } = await supabase.from("resume_documents").select("settings").eq("id", resumeId).maybeSingle();
  if (!doc) return { ok: false, kind: "error", message: "Resume not found." };
  const settings = { ...(doc.settings as Record<string, unknown>), summaryOverride: out.data.summary.slice(0, 1200) };
  const { error } = await supabase.from("resume_documents").update({ settings }).eq("id", resumeId);
  return error ? { ok: false, kind: "error", message: "Could not save the summary." } : { ok: true, value: { summary: out.data.summary } };
}

export { skillLabel };
