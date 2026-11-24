import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AiError, GeminiProvider, routeGenerate, type AiProvider } from "./index";

const schema = z.object({ summary: z.string() });
const req = { messages: [{ role: "system" as const, content: "sys" }, { role: "user" as const, content: "hi" }], schema };
const ok = (text: string) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }], usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 7 } }), { status: 200 });

describe("GeminiProvider", () => {
  it("sends the key in a header (not the URL), maps roles, and validates output", async () => {
    let seen: { url: string; headers: Record<string, string>; body: any } | undefined;
    const p = new GeminiProvider({ apiKey: "K", fetchImpl: (async (url: string, init: any) => { seen = { url, headers: init.headers, body: JSON.parse(init.body) }; return ok('```json\n{"summary":"hello"}\n```'); }) as never });
    const r = await p.generate("gemini-2.5-flash", req);
    expect(r.value).toEqual({ summary: "hello" });
    expect(r.provider).toBe("gemini");
    expect(r.promptTokens).toBe(5);
    expect(seen!.url).not.toContain("K");
    expect(seen!.headers["x-goog-api-key"]).toBe("K");
    expect(seen!.body.systemInstruction.parts[0].text).toBe("sys");
    expect(seen!.body.contents).toEqual([{ role: "user", parts: [{ text: "hi" }] }]);
  });
  it("maps quota, key and schema failures to typed errors", async () => {
    const mk = (res: Response) => new GeminiProvider({ apiKey: "K", fetchImpl: (async () => res) as never });
    await expect(mk(new Response("", { status: 429 })).generate("m", req)).rejects.toMatchObject({ code: "quota_exceeded", retryable: true });
    await expect(mk(new Response("", { status: 403 })).generate("m", req)).rejects.toMatchObject({ code: "provider_unavailable", retryable: false });
    await expect(mk(ok('{"wrong":1}')).generate("m", req)).rejects.toMatchObject({ code: "invalid_output" });
  });
});

describe("Gemini model fallback", () => {
  it("moves to the fallback model when the main one is overloaded", async () => {
    const urls: string[] = [];
    const p = new GeminiProvider({ apiKey: "K", fallbackModels: ["lite"], fetchImpl: (async (url: string) => { urls.push(url); return urls.length <= 2 ? new Response("", { status: 503 }) : ok('{"summary":"ok"}'); }) as never });
    const r = await p.generate("big", req);
    expect(r.model).toBe("lite");
    expect(urls[0]).toContain("/models/big:");
    expect(urls[2]).toContain("/models/lite:");
  });
});

describe("cloud-first routing", () => {
  const fake = (name: string, fn: () => Promise<any>): AiProvider => ({ name, isLocal: name === "local", health: async () => ({ ok: true, provider: name, models: [] }), generate: fn as never });
  const value = (provider: string) => async () => ({ value: { summary: provider }, provider, model: "m", promptTokens: 0, completionTokens: 0, durationMs: 1 });
  const cloud = (p: AiProvider, extra = {}) => ({ provider: p, model: "g", enabled: true, first: true, assumeConsent: true, ...extra });

  it("uses the cloud provider first when the operator chose it", async () => {
    const r = await routeGenerate(fake("local", value("local")), { localModels: ["a"], cloud: cloud(fake("gemini", value("gemini"))) }, { cloudConsent: false }, req);
    expect(r.provider).toBe("gemini");
  });
  it("falls back to local models when the cloud is rate-limited", async () => {
    const limited = fake("gemini", async () => { throw new AiError("quota_exceeded", "x", true); });
    const r = await routeGenerate(fake("local", value("local")), { localModels: ["a"], cloud: cloud(limited) }, { cloudConsent: false }, req);
    expect(r.provider).toBe("local");
  });
  it("never uses the cloud without operator or per-job consent", async () => {
    const spy = fake("gemini", value("gemini"));
    const r = await routeGenerate(fake("local", value("local")), { localModels: ["a"], cloud: cloud(spy, { assumeConsent: false }) }, { cloudConsent: false }, req);
    expect(r.provider).toBe("local");
  });
});
