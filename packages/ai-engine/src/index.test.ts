import { describe, expect, it } from "vitest";
import { z } from "zod";
import { MasterProfile } from "@gars/resume-schema";
import {
  AiError, buildRewriteBulletsTask, isSkillLikeTerm, buildSummaryTask, factCheck, OllamaProvider, parseJsonOutput, profileFacts,
  routeGenerate, userFacingAiError, type AiProvider,
} from "./index";

const profile = MasterProfile.parse({
  schemaVersion: 1,
  personal: { fullName: "Ayesha Khan", professionalTitle: "Software Engineer", email: "ayesha@example.com", phone: "+966 55 123 4567" },
  experience: [{ id: "w1", employer: "Tech Solutions", title: "Senior Software Engineer", dates: { start: "2021-01", current: true },
    bullets: [{ id: "b1", text: "Led a team of 4 developers" }, { id: "b2", text: "Improved performance by 40%" }] }],
  skills: [{ id: "s1", name: "React" }, { id: "s2", name: "Node.js" }],
});

const fakeFetch = (handler: (url: string, body: any) => Response | Promise<Response>) =>
  (async (url: string, init?: RequestInit) => handler(url, init?.body ? JSON.parse(init.body as string) : undefined)) as unknown as typeof fetch;

describe("parseJsonOutput", () => {
  it("strips fences and think blocks", () => {
    expect(parseJsonOutput('<think>hmm</think>```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonOutput('Sure! {"a":2} hope that helps')).toEqual({ a: 2 });
  });
  it("throws invalid_output", () => expect(() => parseJsonOutput("nope")).toThrow(AiError));
});

describe("OllamaProvider", () => {
  it("refuses non-loopback URLs by default", () => {
    expect(() => new OllamaProvider({ baseUrl: "http://203.0.113.5:11434" })).toThrow(/non-loopback/);
    expect(() => new OllamaProvider({ baseUrl: "http://localhost:11434" })).not.toThrow();
  });
  it("validates structured output and reports usage", async () => {
    const p = new OllamaProvider({ fetchImpl: fakeFetch(() => Response.json({ message: { content: '{"summary":"A long enough summary text here."}' }, prompt_eval_count: 10, eval_count: 5 })) });
    const r = await p.generate("m", { messages: [], schema: z.object({ summary: z.string() }) });
    expect(r).toMatchObject({ value: { summary: "A long enough summary text here." }, promptTokens: 10, completionTokens: 5, provider: "ollama" });
  });
  it("invalid shape → invalid_output (retryable)", async () => {
    const p = new OllamaProvider({ fetchImpl: fakeFetch(() => Response.json({ message: { content: '{"x":1}' } })) });
    await expect(p.generate("m", { messages: [], schema: z.object({ summary: z.string() }) })).rejects.toMatchObject({ code: "invalid_output", retryable: true });
  });
  it("connection refused → provider_unavailable; health reports not ok", async () => {
    const p = new OllamaProvider({ fetchImpl: (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch });
    await expect(p.generate("m", { messages: [], schema: z.any() })).rejects.toMatchObject({ code: "provider_unavailable" });
    expect((await p.health()).ok).toBe(false);
  });
  it("404 → model_missing (not retryable)", async () => {
    const p = new OllamaProvider({ fetchImpl: fakeFetch(() => new Response("", { status: 404 })) });
    await expect(p.generate("m", { messages: [], schema: z.any() })).rejects.toMatchObject({ code: "model_missing", retryable: false });
  });
});

describe("routeGenerate", () => {
  const mk = (impl: (model: string) => any): AiProvider => ({ name: "x", isLocal: true, health: async () => ({ ok: true, provider: "x", models: [] }), generate: async (m) => impl(m) });
  const noSleep = async () => {};
  const req = { messages: [], schema: z.any() };

  it("retries invalid output then succeeds", async () => {
    let n = 0;
    const r = await routeGenerate(mk(() => { if (n++ === 0) throw new AiError("invalid_output", "x", true); return { value: 1, provider: "x", model: "a", promptTokens: 0, completionTokens: 0, durationMs: 0 }; }),
      { localModels: ["a"], sleep: noSleep }, { cloudConsent: false }, req);
    expect(r.attempts).toBe(2);
  });
  it("falls to next local model when one is missing", async () => {
    const r = await routeGenerate(mk((m) => { if (m === "a") throw new AiError("model_missing", "x", false); return { value: m, provider: "x", model: m, promptTokens: 0, completionTokens: 0, durationMs: 0 }; }),
      { localModels: ["a", "b"], sleep: noSleep }, { cloudConsent: false }, req);
    expect(r.value).toBe("b");
  });
  it("Ollama down + cloud disabled → safe provider_unavailable error (workflow I)", async () => {
    const down = mk(() => { throw new AiError("provider_unavailable", "x", true); });
    const err = await routeGenerate(down, { localModels: ["a", "b"], sleep: noSleep }, { cloudConsent: true }, req).catch((e) => e);
    expect(err.code).toBe("provider_unavailable");
    const ui = userFacingAiError(err);
    expect(ui.message).toMatch(/temporarily unavailable/);
    expect(ui.message).not.toMatch(/ollama|11434|http/i);
  });
  it("cloud never used without consent, even if enabled", async () => {
    let cloudCalled = false;
    const cloud = mk(() => { cloudCalled = true; return {}; });
    const down = mk(() => { throw new AiError("provider_unavailable", "x", true); });
    const err = await routeGenerate(down, { localModels: ["a"], sleep: noSleep, cloud: { provider: cloud, model: "c", enabled: true } }, { cloudConsent: false }, req).catch((e) => e);
    expect(err.code).toBe("cloud_not_permitted");
    expect(cloudCalled).toBe(false);
  });
});

describe("factCheck", () => {
  const src = ["Led a team of 4 developers at Tech Solutions. Improved performance by 40%. Skills: React, Node.js"];
  it("passes faithful rephrasing", () =>
    expect(factCheck({ output: "Led four developers at Tech Solutions and improved performance by 40%.", sourceTexts: src }).ok).toBe(true));
  it("blocks invented numbers", () => {
    const r = factCheck({ output: "Improved performance by 65% for 2 million users.", sourceTexts: src });
    expect(r.ok).toBe(false);
    expect(r.violations.map((v) => v.value)).toEqual(expect.arrayContaining(["65", "2"]));
  });
  it("blocks invented skills", () => {
    const r = factCheck({ output: "Built services with React and Kubernetes.", sourceTexts: src });
    expect(r.violations).toContainEqual({ kind: "new_skill", value: "kubernetes", severity: "block" });
  });
  it("no false positives for month names or trailing punctuation (live qwen3:4b regression)", () => {
    const r = factCheck({
      output: "Site Engineer at Al Bina Contracting since March 2019. Coordinated work using AutoCAD and Primavera.",
      sourceTexts: ["Role: Site Engineer at Al Bina Contracting (2019-03 – present)", "Skills: AutoCAD, Primavera"],
      knownSkills: ["AutoCAD", "Primavera"],
    });
    expect(r.violations).toEqual([]);
  });
  it("blocks invented experience length (live llama3.2:3b regression)", () => {
    const r = factCheck({ output: "Site Engineer with 4+ years of experience.", sourceTexts: ["Role: Site Engineer (2019-03 – present)"] });
    expect(r.ok).toBe(false);
  });
  it("flags unknown organisations for review", () => {
    const r = factCheck({ output: "Previously consulted for Google on cloud projects.", sourceTexts: src });
    expect(r.violations.some((v) => v.kind === "new_entity" && v.value === "google")).toBe(true);
  });
});

describe("isSkillLikeTerm", () => {
  const jd = "Site Engineer\nRequirements:\n- Revit and BIM coordination\n- Manage projects with Kubernetes\nProjects are large.";
  it.each([["revit", true], ["bim", true], ["kubernetes", true], ["projects", false], ["coordination", false], ["manage", false]])("%s → %s", (t, want) =>
    expect(isSkillLikeTerm(t, jd)).toBe(want));
});

describe("task builders", () => {
  it("never send contact details to the model", () => {
    const f = profileFacts(profile).text;
    expect(f).not.toContain("ayesha@example.com");
    expect(f).not.toContain("+966");
  });
  it("summary prompt states no-invention rules and target language", () => {
    const t = buildSummaryTask(profile, { tone: "professional", length: "medium", locale: "ar" });
    expect(t.messages[0]!.content).toMatch(/Never invent/);
    expect(t.messages[1]!.content).toContain("Arabic");
    expect(t.messages[1]!.content).toMatch(/do not include dates/i);
    expect(t.messages[1]!.content).toMatch(/no "I", "my" or "me"/);
    expect(t.check({ summary: "Senior engineer who increased revenue by 300%." }).ok).toBe(false);
  });
  it("bullet task rejects unknown experience", () => expect(() => buildRewriteBulletsTask(profile, "nope", { tone: "concise", locale: "en" })).toThrow());
});
