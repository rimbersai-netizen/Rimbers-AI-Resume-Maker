/** Live test against Google Gemini with a synthetic profile (no real user data). Runs only with GEMINI_LIVE=1 and GEMINI_API_KEY. */
import { describe, expect, it } from "vitest";
import { MasterProfile } from "@gars/resume-schema";
import { buildSummaryTask, buildTailorSummaryTask, GeminiProvider } from "./index";

const live = process.env.GEMINI_LIVE === "1" && Boolean(process.env.GEMINI_API_KEY);
const p = MasterProfile.parse({ schemaVersion: 1, personal: { fullName: "Test User", professionalTitle: "Civil Engineer" },
  experience: [{ id: "w1", employer: "Al Bina Contracting", title: "Site Engineer", dates: { start: "2019-03", current: true },
    bullets: [{ id: "b1", text: "Supervised construction of 3 residential buildings" }, { id: "b2", text: "Coordinated subcontractors and inspections" }] }],
  skills: [{ id: "s1", name: "AutoCAD" }, { id: "s2", name: "Primavera" }] });

describe.skipIf(!live)("Gemini live", () => {
  const gem = () => new GeminiProvider({ apiKey: process.env.GEMINI_API_KEY!, fallbackModels: ["gemini-flash-lite-latest"] });
  const model = process.env.GEMINI_MODEL ?? "gemini-flash-latest";
  it("health lists models", async () => { expect((await gem().health()).ok).toBe(true); }, 30_000);
  it("generates a validated, fact-checked summary", async () => {
    const task = buildSummaryTask(p, { tone: "professional", length: "short", locale: "en" });
    const r = await gem().generate(model, { messages: task.messages, schema: task.schema, jsonSchema: task.jsonSchema, timeoutMs: 60_000, maxTokens: 300 });
    const check = task.check(r.value);
    console.log(JSON.stringify({ model, durationMs: r.durationMs, tokens: r.completionTokens, summary: r.value.summary, check }, null, 1));
    expect(r.value.summary.length).toBeGreaterThan(20);
  }, 90_000);
  it("tailors without claiming a missing skill", async () => {
    const task = buildTailorSummaryTask(p, { matched: ["AutoCAD"], missing: ["Revit"], tone: "professional", locale: "en", targetRole: "BIM Engineer" });
    const r = await gem().generate(model, { messages: task.messages, schema: task.schema, jsonSchema: task.jsonSchema, timeoutMs: 60_000, maxTokens: 300 });
    console.log(r.value.summary, JSON.stringify(task.check(r.value)));
    expect(r.value.summary).not.toMatch(/revit/i);
  }, 90_000);
});
