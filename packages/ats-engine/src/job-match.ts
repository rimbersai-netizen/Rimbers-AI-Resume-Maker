/**
 * Job ↔ profile match estimate for the Discover feed and job tailoring.
 * Deterministic and explainable: every point comes from skills, role title or years that are visible in the
 * job text and in the user's own profile. It is an estimate, not a prediction of any employer's decision.
 */
import type { MasterProfile } from "@gars/resume-schema";
import { extractKeywords, matchKeywords, stem, tokenize } from "./keywords";
import { profileToText } from "./index";

/** Canonical skill vocabulary (lower-case). Display names for the few that are not simply capitalised. */
const SKILL_TERMS = `javascript typescript python java kotlin swift dart go rust ruby php c# c++ scala r sql nosql html css sass
react react-native next.js vue angular svelte node.js express nestjs django flask fastapi spring laravel rails .net flutter android ios
graphql rest api grpc websockets postgresql mysql mongodb redis elasticsearch sqlite firebase supabase dynamodb snowflake bigquery
aws azure google-cloud gcp docker kubernetes terraform ansible jenkins github-actions ci/cd linux bash git microservices serverless
machine-learning deep-learning nlp llm llms prompt-engineering rag pytorch tensorflow scikit-learn pandas numpy spark hadoop airflow dbt
data-analysis data-engineering etl power-bi tableau excel looker statistics a/b-testing
figma sketch ui ux user-research prototyping design-systems accessibility adobe-photoshop illustrator
agile scrum kanban jira project-management product-management roadmapping stakeholder-management okrs
seo sem content-marketing copywriting social-media google-analytics email-marketing crm salesforce hubspot
sales negotiation account-management customer-success customer-service support
accounting bookkeeping financial-reporting budgeting forecasting auditing payroll quickbooks sap erp
recruiting onboarding hr compliance procurement logistics supply-chain inventory
autocad revit solidworks plc scada hse construction surveying
testing qa automation selenium cypress playwright jest unit-testing tdd security penetration-testing devops sre
leadership mentoring communication teamwork problem-solving public-speaking`.split(/\s+/).filter(Boolean);

const ALIASES: Record<string, string> = {
  js: "javascript", ts: "typescript", reactjs: "react", "react.js": "react", nextjs: "next.js", nodejs: "node.js", node: "node.js",
  golang: "go", postgres: "postgresql", psql: "postgresql", mongo: "mongodb", k8s: "kubernetes", "google cloud": "google-cloud",
  "amazon web services": "aws", "machine learning": "machine-learning", "deep learning": "deep-learning", "natural language processing": "nlp",
  "large language model": "llm", "large language models": "llms", "prompt engineering": "prompt-engineering", "react native": "react-native",
  "data analysis": "data-analysis", "data engineering": "data-engineering", "power bi": "power-bi", "ci cd": "ci/cd", "unit testing": "unit-testing",
  "project management": "project-management", "product management": "product-management", "stakeholder management": "stakeholder-management",
  "content marketing": "content-marketing", "social media": "social-media", "google analytics": "google-analytics", "email marketing": "email-marketing",
  "customer success": "customer-success", "customer service": "customer-service", "account management": "account-management",
  "financial reporting": "financial-reporting", "supply chain": "supply-chain", "problem solving": "problem-solving", "public speaking": "public-speaking",
  "user research": "user-research", "design systems": "design-systems", "github actions": "github-actions", "penetration testing": "penetration-testing",
  "a/b testing": "a/b-testing", "scikit learn": "scikit-learn", "adobe photoshop": "adobe-photoshop", "ms excel": "excel", "microsoft excel": "excel",
  "dotnet": ".net", "csharp": "c#",
};

const DISPLAY: Record<string, string> = {
  javascript: "JavaScript", typescript: "TypeScript", "node.js": "Node.js", "next.js": "Next.js", postgresql: "PostgreSQL", mysql: "MySQL", mongodb: "MongoDB",
  aws: "AWS", gcp: "GCP", "google-cloud": "Google Cloud", graphql: "GraphQL", nosql: "NoSQL", sql: "SQL", html: "HTML", css: "CSS", api: "API", rest: "REST",
  "ci/cd": "CI/CD", llm: "LLM", llms: "LLMs", nlp: "NLP", rag: "RAG", ui: "UI", ux: "UX", seo: "SEO", sem: "SEM", crm: "CRM", hr: "HR", qa: "QA",
  sre: "SRE", tdd: "TDD", okrs: "OKRs", erp: "ERP", sap: "SAP", hse: "HSE", plc: "PLC", scada: "SCADA", etl: "ETL", dbt: "dbt", ios: "iOS", ".net": ".NET",
  "c#": "C#", "c++": "C++", "react-native": "React Native", "a/b-testing": "A/B Testing", "power-bi": "Power BI", "scikit-learn": "scikit-learn",
  pytorch: "PyTorch", tensorflow: "TensorFlow", fastapi: "FastAPI", nestjs: "NestJS", grpc: "gRPC", websockets: "WebSockets", dynamodb: "DynamoDB",
  bigquery: "BigQuery", github: "GitHub", "github-actions": "GitHub Actions", hubspot: "HubSpot", quickbooks: "QuickBooks", solidworks: "SolidWorks",
  autocad: "AutoCAD", jira: "Jira", figma: "Figma", "adobe-photoshop": "Photoshop",
};

export function skillLabel(canonicalTerm: string): string {
  return DISPLAY[canonicalTerm] ?? canonicalTerm.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
const BOUNDARY_L = "(?<![\\p{L}\\p{N}+#.])";
const BOUNDARY_R = "(?![\\p{L}\\p{N}+#])";
const SKILL_RES: [string, RegExp][] = (() => {
  const forms = new Map<string, string>(); // surface form -> canonical
  for (const t of SKILL_TERMS) {
    forms.set(t.replace(/-/g, " "), t);
    if (t.includes("-")) forms.set(t, t);
  }
  for (const [alias, canon] of Object.entries(ALIASES)) forms.set(alias, canon);
  const byCanon = new Map<string, string[]>();
  for (const [form, canon] of forms) byCanon.set(canon, [...(byCanon.get(canon) ?? []), form]);
  return [...byCanon.entries()].map(([canon, fs]) => [
    canon,
    new RegExp(`${BOUNDARY_L}(?:${fs.sort((a, b) => b.length - a.length).map(esc).join("|")})${BOUNDARY_R}`, "giu"),
  ]);
})();

/** Words that are also everyday English: in prose they only count when written the way the skill is (Go, R, Swift, REST). */
const AMBIGUOUS: Record<string, RegExp> = {
  go: new RegExp(`${BOUNDARY_L}Go${BOUNDARY_R}(?!\s+(?:to|further|ahead|live|beyond|above|the|and|for|through|with)\b)`, "gu"),
  r: new RegExp(`${BOUNDARY_L}R${BOUNDARY_R}`, "gu"),
  swift: new RegExp(`${BOUNDARY_L}Swift${BOUNDARY_R}`, "gu"),
  rest: new RegExp(`${BOUNDARY_L}REST(?:ful)?${BOUNDARY_R}|${BOUNDARY_L}Rest(?:ful)?\s+APIs?${BOUNDARY_R}`, "gu"),
};

/**
 * Canonical skills found in free text, with how often each appears.
 * `loose` is for text that is a plain list of skill names (e.g. the profile skills field), where "go" is clearly the language.
 */
export function detectSkills(text: string, loose = false): Map<string, number> {
  const out = new Map<string, number>();
  const t = text.toLowerCase();
  for (const [canon, re] of SKILL_RES) {
    const amb = AMBIGUOUS[canon];
    const rx = amb && !loose ? amb : re;
    rx.lastIndex = 0;
    const n = (amb && !loose ? text : t).match(rx)?.length ?? 0;
    if (n) out.set(canon, n);
  }
  return out;
}

/** Having the first skill means you effectively have the second (a React/TypeScript dev does not lack "JavaScript"). */
const IMPLIES: Record<string, string[]> = {
  typescript: ["javascript"], react: ["javascript", "html", "css"], "next.js": ["react", "javascript"], "node.js": ["javascript"], vue: ["javascript"], angular: ["javascript", "typescript"],
  svelte: ["javascript"], express: ["node.js", "javascript"], nestjs: ["node.js", "typescript"], "react-native": ["react", "javascript"], flutter: ["dart"],
  django: ["python"], flask: ["python"], fastapi: ["python"], pandas: ["python"], numpy: ["python"], pytorch: ["python", "machine-learning"], tensorflow: ["python", "machine-learning"],
  "scikit-learn": ["python", "machine-learning"], spring: ["java"], rails: ["ruby"], laravel: ["php"], postgresql: ["sql"], mysql: ["sql"], snowflake: ["sql"], bigquery: ["sql"],
  "deep-learning": ["machine-learning"], llm: ["nlp"], llms: ["nlp"], kubernetes: ["docker"], "github-actions": ["ci/cd", "git"], jenkins: ["ci/cd"], terraform: ["devops"],
};
/** Generic words that appear in almost every posting: they count, but far less than a concrete tool or language. */
const GENERIC = new Set(["api", "rest", "support", "testing", "automation", "security", "communication", "leadership", "teamwork", "problem-solving", "agile", "scrum", "git", "linux", "ui", "ux", "qa", "sales", "customer-service", "compliance", "statistics", "excel", "mentoring", "public-speaking", "devops", "sql", "html", "css"]);
export const withImplied = (m: Map<string, number>): Map<string, number> => {
  const out = new Map(m);
  for (const k of m.keys()) for (const i of IMPLIES[k] ?? []) if (!out.has(i)) out.set(i, 1);
  return out;
};

export interface JobInput { title: string; description: string; tags?: string[] }
export interface SkillHit { skill: string; label: string; required: boolean }
export type MatchLabel = "strong" | "good" | "stretch";
export interface JobMatch {
  /** 0–100 estimate. */
  score: number;
  label: MatchLabel;
  matched: SkillHit[];
  missing: SkillHit[];
  /** Years the posting asks for, if stated. */
  requiredYears?: number;
  /** Total years of experience found on the profile. */
  profileYears: number;
  parts: { skills: number; title: number; seniority: number };
}

export const matchLabel = (score: number): MatchLabel => (score >= 75 ? "strong" : score >= 50 ? "good" : "stretch");

const SENIORITY = new Set("senior sr junior jr lead principal staff head chief mid entry level associate intern manager director vp".split(" "));
const TITLE_STOP = new Set(["and", "or", "the", "of", "for", "at", "in", "to", "a", "an", "with", "remote", "full", "time", "part", "m", "w", "d", "f"]);
const titleTokens = (s: string) => tokenize(s).filter((t) => !SENIORITY.has(t) && !TITLE_STOP.has(t) && !/^\d+$/.test(t)).map(stem);

export function requiredYears(text: string): number | undefined {
  let best: number | undefined;
  for (const m of text.matchAll(/(\d{1,2})\s*\+?\s*(?:-\s*\d{1,2}\s*)?(?:years?|yrs?)\b/gi)) {
    const n = Number(m[1]);
    if (n > 0 && n <= 25) best = best === undefined ? n : Math.min(best, n); // the lowest stated bar is the real requirement
  }
  return best;
}

function monthIndex(d: string): number | undefined {
  const m = /^(\d{4})(?:-(\d{2}))?/.exec(d);
  return m ? Number(m[1]) * 12 + (m[2] ? Number(m[2]) - 1 : 0) : undefined;
}

export function profileYears(p: MasterProfile, now = new Date()): number {
  const nowIdx = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const spans = p.experience.flatMap((w) => {
    const s = w.dates.start ? monthIndex(w.dates.start) : undefined;
    const e = w.dates.current ? nowIdx : w.dates.end ? monthIndex(w.dates.end) : undefined;
    return s !== undefined && e !== undefined && e >= s ? [[s, e] as const] : [];
  }).sort((a, b) => a[0] - b[0]);
  let total = 0, curEnd = -Infinity, curStart = 0;
  for (const [s, e] of spans) { // union of ranges so overlapping jobs are not double counted
    if (s > curEnd) { if (curEnd > -Infinity) total += curEnd - curStart; curStart = s; curEnd = e; }
    else curEnd = Math.max(curEnd, e);
  }
  if (curEnd > -Infinity) total += curEnd - curStart;
  return Math.round((total / 12) * 10) / 10;
}

const REQ_SECTION = /(requirements?|qualifications|must[- ]have|what you(?:'|’)?ll need|what we(?:'|’)?re looking for|you have)\s*:?/i;

/** Skills the posting mentions, with required/preferred flag and weight. */
export function jobSkills(job: JobInput): { skill: string; weight: number; required: boolean }[] {
  const body = job.description;
  const idx = body.search(REQ_SECTION);
  const reqText = idx >= 0 ? body.slice(idx, idx + 1800).toLowerCase() : "";
  const inTitle = detectSkills(job.title);
  const inTags = detectSkills((job.tags ?? []).join(" , "));
  const inBody = detectSkills(body);
  const all = new Set([...inTitle.keys(), ...inTags.keys(), ...inBody.keys()]);
  return [...all].map((skill) => {
    const required = inTitle.has(skill) || (reqText ? detectSkills(reqText).has(skill) : false) || (inBody.get(skill) ?? 0) >= 3;
    const raw = (inTitle.has(skill) ? 3 : 0) + (inTags.has(skill) ? 2 : 0) + ((inBody.get(skill) ?? 0) >= 2 ? 1.5 : 1) + (required ? 1 : 0);
    const weight = GENERIC.has(skill) ? raw * 0.4 : raw;
    return { skill, weight, required };
  }).sort((a, b) => b.weight - a.weight).slice(0, 18);
}

export function scoreJob(p: MasterProfile, job: JobInput, now = new Date()): JobMatch {
  const mine = withImplied(new Map([...detectSkills(profileToText(p)), ...detectSkills(p.skills.map((s) => s.name).join(" , "), true)]));
  const wanted = jobSkills(job);
  const hit = (s: { skill: string; required: boolean }): SkillHit => ({ skill: s.skill, label: skillLabel(s.skill), required: s.required });
  const matched = wanted.filter((s) => mine.has(s.skill)).map(hit);
  const missing = wanted.filter((s) => !mine.has(s.skill)).map(hit);

  let skills: number;
  if (wanted.length) {
    const total = wanted.reduce((n, s) => n + s.weight, 0);
    skills = wanted.filter((s) => mine.has(s.skill)).reduce((n, s) => n + s.weight, 0) / total;
  } else {
    // No recognisable skills in the posting: fall back to plain keyword overlap, capped so it cannot look "strong".
    skills = Math.min(0.6, matchKeywords(extractKeywords(`${job.title}\n${job.description}`, 15), profileToText(p)).score / 100);
  }

  const mineTitles = new Set(titleTokens([p.personal.professionalTitle ?? "", ...p.experience.map((w) => w.title)].join(" ")));
  const jt = titleTokens(job.title);
  const title = jt.length ? jt.filter((t) => mineTitles.has(t)).length / jt.length : 0.5;

  const ry = requiredYears(job.description);
  const py = profileYears(p, now);
  const seniority = ry === undefined ? 0.7 : Math.min(1, py / ry);

  const score = Math.max(0, Math.min(100, Math.round(100 * (0.65 * skills + 0.2 * title + 0.15 * seniority))));
  return { score, label: matchLabel(score), matched, missing, requiredYears: ry, profileYears: py, parts: { skills, title, seniority } };
}

export interface TailorPlan {
  /** Required/preferred skills already listed on the profile — nothing to change. */
  strengths: SkillHit[];
  /** In the profile's own experience/projects text but not in its skills list — safe to surface. */
  optimizations: SkillHit[];
  /** Not found anywhere on the profile — only add if the user confirms they really have it. */
  gaps: SkillHit[];
}

export function tailorPlan(p: MasterProfile, job: JobInput): TailorPlan {
  const listed = withImplied(detectSkills(p.skills.map((s) => s.name).join(" , "), true));
  const everywhere = withImplied(new Map([...detectSkills(profileToText(p)), ...listed]));
  const wanted = jobSkills(job);
  const hit = (s: { skill: string; required: boolean }): SkillHit => ({ skill: s.skill, label: skillLabel(s.skill), required: s.required });
  return {
    strengths: wanted.filter((s) => listed.has(s.skill)).map(hit),
    optimizations: wanted.filter((s) => !listed.has(s.skill) && everywhere.has(s.skill)).map(hit),
    gaps: wanted.filter((s) => !everywhere.has(s.skill)).map(hit),
  };
}
