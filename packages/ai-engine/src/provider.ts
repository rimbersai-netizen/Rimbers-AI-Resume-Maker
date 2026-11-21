/**
 * AI provider abstraction. Server-side only (ai-worker / edge functions) — never import in client bundles.
 * Ollama is the default; cloud providers are optional and require explicit configuration + user consent.
 */
import type { ZodType } from "zod";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GenerateRequest<T> {
  messages: ChatMessage[];
  /** Output is parsed as JSON and validated; invalid output counts as a failed attempt. */
  schema: ZodType<T>;
  /** JSON schema passed to the model for constrained decoding when supported. */
  jsonSchema?: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface GenerateResult<T> {
  value: T;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  durationMs: number;
}

export type AiErrorCode =
  | "provider_unavailable" | "timeout" | "invalid_output" | "model_missing" | "cloud_not_permitted" | "quota_exceeded" | "unknown";

export class AiError extends Error {
  constructor(public readonly code: AiErrorCode, message: string, public readonly retryable: boolean) {
    super(message);
    this.name = "AiError";
  }
}

export interface ProviderHealth {
  ok: boolean;
  provider: string;
  models: string[];
  error?: string;
}

export interface AiProvider {
  readonly name: string;
  readonly isLocal: boolean;
  health(): Promise<ProviderHealth>;
  generate<T>(model: string, req: GenerateRequest<T>): Promise<GenerateResult<T>>;
}

/** Parse model text as JSON — tolerating ```json fences and <think> blocks some local models emit. */
export function parseJsonOutput(text: string): unknown {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new AiError("invalid_output", "Model did not return JSON", true);
  }
}
