import { AiError, parseJsonOutput, type AiProvider, type GenerateRequest, type GenerateResult, type ProviderHealth } from "./provider";

export interface OllamaOptions {
  /** Must be a private/loopback address. Never expose Ollama publicly. */
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  /** Allow a non-loopback host (e.g. a private VPC address). Off by default. */
  allowNonLoopback?: boolean;
}

const LOOPBACK = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?\/?$/;

export class OllamaProvider implements AiProvider {
  readonly name = "ollama";
  readonly isLocal = true;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: OllamaOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? "http://127.0.0.1:11434").replace(/\/$/, "");
    if (!opts.allowNonLoopback && !LOOPBACK.test(this.baseUrl)) {
      throw new Error(`Refusing non-loopback Ollama URL ${this.baseUrl}; set allowNonLoopback for a private network host.`);
    }
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private async call(path: string, body: unknown | undefined, timeoutMs: number): Promise<Response> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: ctrl.signal,
      });
    } catch (e) {
      if ((e as Error).name === "AbortError") throw new AiError("timeout", `Ollama timed out after ${timeoutMs} ms`, true);
      throw new AiError("provider_unavailable", "Local AI service is not reachable", true);
    } finally {
      clearTimeout(timer);
    }
  }

  async health(): Promise<ProviderHealth> {
    try {
      const res = await this.call("/api/tags", undefined, 3000);
      if (!res.ok) return { ok: false, provider: this.name, models: [], error: `HTTP ${res.status}` };
      const data = (await res.json()) as { models?: { name: string }[] };
      return { ok: true, provider: this.name, models: (data.models ?? []).map((m) => m.name) };
    } catch (e) {
      return { ok: false, provider: this.name, models: [], error: (e as Error).message };
    }
  }

  async generate<T>(model: string, req: GenerateRequest<T>): Promise<GenerateResult<T>> {
    const started = Date.now();
    const res = await this.call("/api/chat", {
      model,
      messages: req.messages,
      stream: false,
      think: false,
      format: req.jsonSchema ?? "json",
      options: { temperature: req.temperature ?? 0.3, num_predict: req.maxTokens ?? 600 },
    }, req.timeoutMs ?? 120_000);
    if (res.status === 404) throw new AiError("model_missing", `Model ${model} is not installed`, false);
    if (!res.ok) throw new AiError("provider_unavailable", `Ollama HTTP ${res.status}`, res.status >= 500);
    const data = (await res.json()) as { message?: { content?: string }; prompt_eval_count?: number; eval_count?: number };
    const parsed = req.schema.safeParse(parseJsonOutput(data.message?.content ?? ""));
    if (!parsed.success) throw new AiError("invalid_output", `Output failed validation: ${parsed.error.issues[0]?.message}`, true);
    return {
      value: parsed.data,
      provider: this.name,
      model,
      promptTokens: data.prompt_eval_count ?? 0,
      completionTokens: data.eval_count ?? 0,
      durationMs: Date.now() - started,
    };
  }
}
