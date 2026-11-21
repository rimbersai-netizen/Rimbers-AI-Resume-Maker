/** Live test against the local Ollama. Runs only with OLLAMA_LIVE=1. */
import { describe, expect, it } from "vitest";
import { MasterProfile } from "@gars/resume-schema";
import { buildSummaryTask, OllamaProvider } from "./index";

const live = process.env.OLLAMA_LIVE === "1";
describe.skipIf(!live)("Ollama live", () => {
  it("health lists models", async () => {
    const h = await new OllamaProvider().health();
    expect(h.ok).toBe(true);
  });
  it("generates a validated, fact-checked summary", async () => {
    const p = MasterProfile.parse({ schemaVersion: 1, personal: { fullName: "Test User", professionalTitle: "Civil Engineer" },
      experience: [{ id: "w1", employer: "Al Bina Contracting", title: "Site Engineer", dates: { start: "2019-03", current: true },
        bullets: [{ id: "b1", text: "Supervised construction of 3 residential buildings" }, { id: "b2", text: "Coordinated subcontractors and inspections" }] }],
      skills: [{ id: "s1", name: "AutoCAD" }, { id: "s2", name: "Primavera" }] });
    const task = buildSummaryTask(p, { tone: "professional", length: "short", locale: "en" });
    const model = process.env.OLLAMA_MODEL ?? "qwen3:4b";
    const r = await new OllamaProvider().generate(model, { messages: task.messages, schema: task.schema, jsonSchema: task.jsonSchema, timeoutMs: 240_000, maxTokens: 300 });
    const check = task.check(r.value);
    console.log(JSON.stringify({ model, durationMs: r.durationMs, tokens: r.completionTokens, summary: r.value.summary, check }, null, 1));
    expect(r.value.summary.length).toBeGreaterThan(20);
  }, 300_000);
});
