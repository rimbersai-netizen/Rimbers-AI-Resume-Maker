/**
 * Factual-traceability checker. AI output may rephrase, but must not introduce facts that are not in the
 * user's source data: numbers/percentages, years, organisations/proper nouns, or skills.
 * Deterministic so it can gate suggestions before they are shown.
 */
import { tokenize } from "@gars/ats-engine";

const NUMBER_WORDS: Record<string, string> = {
  one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
  eleven: "11", twelve: "12", fifteen: "15", twenty: "20", thirty: "30", fifty: "50", hundred: "100",
};

/** Known skill vocabulary for "new skill" detection; other skills can be passed in. */
const TECH_SKILLS = new Set(("javascript,typescript,python,java,go,rust,c++,c#,php,ruby,swift,kotlin,react,angular,vue,svelte,node.js,next.js," +
  "django,flask,spring,laravel,kubernetes,docker,terraform,aws,azure,google cloud,postgresql,mysql,mongodb,redis,graphql," +
  "excel,sap,salesforce,tableau,power bi,autocad,revit,primavera,sql,html,css,figma,photoshop,jira").split(","));

export type ViolationKind = "new_number" | "new_skill" | "new_entity";
export interface Violation {
  kind: ViolationKind;
  value: string;
  /** "block": must not be shown as-is. "review": shown with a highlight asking the user to confirm. */
  severity: "block" | "review";
}

function numbers(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/\d+(?:[.,]\d+)?/g)) out.add(m[0].replace(",", "."));
  for (const w of text.toLowerCase().match(/\p{L}+/gu) ?? []) if (NUMBER_WORDS[w]) out.add(NUMBER_WORDS[w]!);
  return out;
}

const COMMON_CAPS = new Set(("I The A An In On At For With And Or But Our We My As By To Of From This That It Results Proven Experienced " +
  "Skilled Senior Junior Lead Software Engineer Manager Developer Professional Highly Dedicated Strong Passionate Collaborative Detail " +
  "Over Across During Responsible Led Built Designed Developed Delivered Improved Managed Created").split(" "));

/** Capitalised words not at the start of a sentence — a cheap proxy for organisation/product names. */
function entities(text: string): Set<string> {
  const out = new Set<string>();
  for (const sentence of text.split(/(?<=[.!?])\s+|\n+/)) {
    const ws = sentence.trim().split(/\s+/);
    ws.forEach((w, i) => {
      const clean = w.replace(/^[^\p{L}]+|[^\p{L}\p{N}.+#]+$/gu, "");
      if (i === 0 || clean.length < 2) return;
      if (/^\p{Lu}/u.test(clean) && !COMMON_CAPS.has(clean)) out.add(clean.toLowerCase());
    });
  }
  return out;
}

export interface FactCheckInput {
  output: string;
  /** All source text the model was given (profile fields, accepted content). */
  sourceTexts: string[];
  /** User's own skills (always allowed to appear). */
  knownSkills?: string[];
}

export function factCheck(input: FactCheckInput): { ok: boolean; violations: Violation[] } {
  const source = input.sourceTexts.join("\n");
  const srcNums = numbers(source);
  const srcTokens = new Set([...tokenize(source), ...(input.knownSkills ?? []).flatMap((s) => tokenize(s))]);
  const srcLower = source.toLowerCase();
  const violations: Violation[] = [];

  for (const n of numbers(input.output)) if (!srcNums.has(n)) violations.push({ kind: "new_number", value: n, severity: "block" });

  for (const tok of new Set(tokenize(input.output))) {
    if (TECH_SKILLS.has(tok) && !srcTokens.has(tok)) violations.push({ kind: "new_skill", value: tok, severity: "block" });
  }

  for (const e of entities(input.output)) {
    if (!srcLower.includes(e) && !TECH_SKILLS.has(e)) violations.push({ kind: "new_entity", value: e, severity: "review" });
  }

  return { ok: !violations.some((v) => v.severity === "block"), violations };
}
