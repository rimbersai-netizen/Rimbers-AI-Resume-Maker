import { AiError, parseJsonOutput, type AiProvider, type GenerateRequest, type GenerateResult, type ProviderHealth } from "./provider";

export interface GeminiOptions {
  apiKey: string;
  /** Tried in order when the main model is overloaded (503) or no longer offered (404). */
  fallbackModels?: string[];
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

/**
 * Google Gemini (cloud). Server-side only. Resume content leaves the machine when this provider is used, so the worker
 * enables it only when an operator sets AI_PROVIDER=gemini (or a user consented per job). Output still goes through the
 * same Zod validation and fact-check gate as local models.
 */
export class GeminiProvider implements AiProvider {
  readonly name = "gemini";
  readonly isLocal = false;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly opts: GeminiOptions) {
    if (!opts.apiKey) throw new Error("GeminiProvider needs an API key");
    this.baseUrl = (opts.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private async call(path: string, body: unknown | undefined, timeoutMs: number): Promise<Response> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.opts.apiKey },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: ctrl.signal,
      });
    } catch (e) {
      if ((e as Error).name === "AbortError") throw new AiError("timeout", `Gemini timed out after ${timeoutMs} ms`, true);
      throw new AiError("provider_unavailable", "Cloud AI service is not reachable", true);
    } finally {
      clearTimeout(timer);
    }
  }

  async health(): Promise<ProviderHealth> {
    try {
      const res = await this.call("/models?pageSize=50", undefined, 8000);
      if (!res.ok) return { ok: false, provider: this.name, models: [], error: `HTTP ${res.status}` };
      const data = (await res.json()) as { models?: { name: string }[] };
      return { ok: true, provider: this.name, models: (data.models ?? []).map((m) => m.name.replace(/^models\//, "")) };
    } catch (e) {
      return { ok: false, provider: this.name, models: [], error: (e as Error).message };
    }
  }

  async generate<T>(model: string, req: GenerateRequest<T>): Promise<GenerateResult<T>> {
    let last: unknown;
    for (const m of [model, ...(this.opts.fallbackModels ?? []).filter((x) => x !== model)]) {
      try {
        return await this.generateWith(m, req);
      } catch (e) {
        last = e;
        const retryOtherModel = e instanceof AiError && (e.code === "model_missing" || (e.code === "provider_unavailable" && e.retryable));
        if (!retryOtherModel) throw e;
      }
    }
    throw last;
  }

  private async generateWith<T>(model: string, req: GenerateRequest<T>): Promise<GenerateResult<T>> {
    const started = Date.now();
    const system = req.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const contents = req.messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
    const res = await this.call(`/models/${encodeURIComponent(model)}:generateContent`, {
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents,
      generationConfig: {
        temperature: req.temperature ?? 0.3,
        maxOutputTokens: Math.max(req.maxTokens ?? 600, 2048),
        responseMimeType: "application/json",
      },
    }, req.timeoutMs ?? 60_000);
    if (res.status === 404) throw new AiError("model_missing", `Model ${model} is not available`, false);
    if (res.status === 429) throw new AiError("quota_exceeded", "Gemini rate or quota limit reached", true);
    if (res.status === 401 || res.status === 403) throw new AiError("provider_unavailable", "Gemini rejected the API key", false);
    if (!res.ok) throw new AiError("provider_unavailable", `Gemini HTTP ${res.status}`, res.status >= 500);
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    const cand = data.candidates?.[0];
    const text = (cand?.content?.parts ?? []).map((p) => p.text ?? "").join("");
    if (!text) throw new AiError("invalid_output", `Gemini returned no text (${cand?.finishReason ?? "no candidate"})`, true);
    const parsed = req.schema.safeParse(parseJsonOutput(text));
    if (!parsed.success) throw new AiError("invalid_output", `Output failed validation: ${parsed.error.issues[0]?.message}`, true);
    return {
      value: parsed.data,
      provider: this.name,
      model,
      promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
      completionTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      durationMs: Date.now() - started,
    };
  }
}
