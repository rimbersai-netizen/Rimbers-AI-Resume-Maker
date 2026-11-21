/** Keyword extraction and matching for job-description alignment. Deterministic, explainable. */

const STOPWORDS = new Set(`a an the and or but if of to in on at by for with from as is are was were be been being this that these those
it its we you your our they their he she his her them us i me my will would shall should can could may might must
have has had do does did not no yes than then so such into over under about across per via within without
work working job role team teams company position candidate candidates experience experienced years year plus
strong excellent good great ability able skills skill knowledge understanding including include includes etc
responsibilities responsible requirements required preferred nice looking seeking join who what which where when
new using use used based level high well also other more most least any all each every both either one two three
looking ideal opportunity environment day days time full part`.split(/\s+/));

/** Canonical forms so "JS" matches "JavaScript", "k8s" matches "Kubernetes", etc. */
const SYNONYMS: Record<string, string> = {
  js: "javascript", ts: "typescript", nodejs: "node.js", node: "node.js", reactjs: "react", "react.js": "react",
  k8s: "kubernetes", postgres: "postgresql", psql: "postgresql", golang: "go", py: "python",
  "c sharp": "c#", csharp: "c#", gcp: "google cloud", "amazon web services": "aws", ml: "machine learning",
  ai: "artificial intelligence", ui: "user interface", ux: "user experience", "ms excel": "excel", "microsoft excel": "excel",
  pm: "project management", qa: "quality assurance", hse: "health and safety", autocad: "autocad",
};

/** Multi-word terms recognised as single keywords. */
const PHRASES = [
  "machine learning", "project management", "data analysis", "customer service", "google cloud", "amazon web services",
  "quality assurance", "health and safety", "user experience", "user interface", "continuous integration",
  "financial reporting", "supply chain", "stakeholder management", "agile", "scrum", "rest api", "ci/cd",
  "microsoft excel", "ms excel", "c sharp", "artificial intelligence", "problem solving", "public speaking",
];

export function canonical(term: string): string {
  const t = term.toLowerCase().trim();
  return SYNONYMS[t] ?? t;
}

/** Tokenise keeping tech tokens like c++, c#, node.js, ci/cd, .net. Unicode letters supported. */
export function tokenize(text: string): string[] {
  const lower = ` ${text.toLowerCase().replace(/[’']/g, "")} `;
  const found: string[] = [];
  let rest = lower;
  for (const p of PHRASES) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${p.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "gu");
    const matches = rest.match(re);
    if (matches) {
      for (let i = 0; i < matches.length; i++) found.push(canonical(p));
      rest = rest.replace(re, " ");
    }
  }
  const words = rest.match(/[\p{L}\p{N}][\p{L}\p{N}+#./-]*[\p{L}\p{N}+#]|[\p{L}\p{N}]/gu) ?? [];
  for (const w of words) {
    const clean = w.replace(/[./-]+$/, "");
    if (clean.length < 2 && !/^[cr]$/.test(clean)) continue;
    if (/^\d+(\.\d+)?\+?%?$/.test(clean)) continue; // numbers like 5, 5+, 40%, 3.5 are not keywords
    if (STOPWORDS.has(clean)) continue;
    found.push(canonical(clean));
  }
  return found;
}

export interface Keyword {
  term: string;
  weight: number;
  required: boolean;
}

const REQUIRED_HEADER = /^(requirements?|required|qualifications|must[- ]have|what you need|minimum qualifications)\b/i;
const OPTIONAL_HEADER = /^(nice[- ]to[- ]have|preferred|bonus|desirable|plus|benefits|about us|what we offer|responsibilities)\b/i;
const REQUIRED_INLINE = /\b(required|must have|must be|mandatory|essential)\b/i;

/** Extract the top keywords from a job description; marks terms from requirement sections as required. */
export function extractKeywords(jobDescription: string, limit = 25): Keyword[] {
  const counts = new Map<string, { n: number; required: boolean; firstSeen: number }>();
  let inRequired = false;
  let order = 0;
  for (const rawLine of jobDescription.split(/\r?\n/)) {
    const line = rawLine.replace(/^[\s\-*•·]+/, "").trim();
    if (!line) continue;
    const heading = line.replace(/[:：]\s*$/, "");
    if (REQUIRED_HEADER.test(heading) && heading.length < 60) { inRequired = true; continue; }
    if (OPTIONAL_HEADER.test(heading) && heading.length < 60) { inRequired = false; continue; }
    const req = inRequired || REQUIRED_INLINE.test(line);
    for (const tok of tokenize(line)) {
      const e = counts.get(tok) ?? { n: 0, required: false, firstSeen: order++ };
      e.n += 1;
      e.required ||= req;
      counts.set(tok, e);
    }
  }
  return [...counts.entries()]
    .map(([term, e]) => ({ term, weight: e.n + (e.required ? 2 : 0), required: e.required, firstSeen: e.firstSeen }))
    .sort((a, b) => b.weight - a.weight || a.firstSeen - b.firstSeen)
    .slice(0, limit)
    .map(({ term, weight, required }) => ({ term, weight, required }));
}

export interface KeywordMatch {
  matched: Keyword[];
  missing: Keyword[];
  missingRequired: Keyword[];
  /** 0–100, weight-based. */
  score: number;
}

/**
 * Light English stemmer so word forms match: supervise/supervised, coordination/coordinated, projects/project.
 * Only applied to plain alphabetic words (tech tokens like node.js, c++, ci/cd are matched exactly).
 */
const SUFFIXES: [string, string][] = [["ations", "at"], ["ation", "at"], ["ions", ""], ["ion", ""], ["ings", ""], ["ing", ""], ["ed", ""], ["es", ""], ["s", ""], ["e", ""]];
export function stem(term: string): string {
  if (!/^[a-z]+$/.test(term) || term.length <= 4) return term;
  for (const [suf, rep] of SUFFIXES) {
    if (term.endsWith(suf) && term.length - suf.length + rep.length >= 4) return term.slice(0, -suf.length) + rep;
  }
  return term;
}

export function matchKeywords(keywords: Keyword[], resumeText: string): KeywordMatch {
  const tokens = tokenize(resumeText);
  const have = new Set([...tokens, ...tokens.map(stem)]);
  const hit = (k: Keyword) => have.has(k.term) || have.has(stem(k.term));
  const matched = keywords.filter(hit);
  const missing = keywords.filter((k) => !hit(k));
  const total = keywords.reduce((s, k) => s + k.weight, 0);
  const got = matched.reduce((s, k) => s + k.weight, 0);
  return {
    matched,
    missing,
    missingRequired: missing.filter((k) => k.required),
    score: total ? Math.round((got / total) * 100) : 0,
  };
}
