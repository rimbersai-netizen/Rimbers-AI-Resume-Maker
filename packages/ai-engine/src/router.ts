import { AiError, type AiProvider, type GenerateRequest, type GenerateResult } from "./provider";

export interface RouteConfig {
  /** Ordered local models to try, e.g. ["qwen3:4b", "llama3.2:3b"]. */
  localModels: string[];
  maxAttempts?: number;
  backoffMs?: number;
  /** Cloud fallback: only used if enabled by admin AND consented by the user for this job. */
  cloud?: {
    provider: AiProvider; model: string; enabled: boolean;
    /** Operator chose this provider as primary (e.g. AI_PROVIDER=gemini): try it before local models; local models become the fallback. */
    first?: boolean;
    /** Operator-level consent for every job (set only by an explicit deployment decision). Otherwise per-job `cloudConsent` is required. */
    assumeConsent?: boolean;
  };
  sleep?: (ms: number) => Promise<void>;
}

export interface RouteContext {
  /** Per-user, per-request explicit consent to send this content to an external provider. */
  cloudConsent: boolean;
}

/**
 * Try local models with retries/backoff; fall back to cloud only when explicitly permitted.
 * Non-retryable errors (model missing) move to the next model immediately.
 */
export async function routeGenerate<T>(
  local: AiProvider,
  cfg: RouteConfig,
  ctx: RouteContext,
  req: GenerateRequest<T>,
): Promise<GenerateResult<T> & { attempts: number }> {
  const sleep = cfg.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const max = cfg.maxAttempts ?? 2;
  let attempts = 0;
  let last: AiError | undefined;

  const cloudAllowed = Boolean(cfg.cloud?.enabled && (ctx.cloudConsent || cfg.cloud.assumeConsent));
  if (cfg.cloud?.first && cloudAllowed) {
    for (let i = 0; i < max; i++) {
      attempts++;
      try {
        return { ...(await cfg.cloud.provider.generate(cfg.cloud.model, req)), attempts };
      } catch (e) {
        last = e instanceof AiError ? e : new AiError("unknown", (e as Error).message, false);
        if (!last.retryable || last.code === "quota_exceeded") break; // transient 5xx is retried once; otherwise fall back to local models
        await sleep((cfg.backoffMs ?? 500) * 2 ** i);
      }
    }
  }

  for (const model of cfg.localModels) {
    for (let i = 0; i < max; i++) {
      attempts++;
      try {
        return { ...(await local.generate(model, req)), attempts };
      } catch (e) {
        last = e instanceof AiError ? e : new AiError("unknown", (e as Error).message, false);
        if (last.code === "provider_unavailable") break; // service down: no point retrying other local models quickly
        if (!last.retryable) break;
        await sleep((cfg.backoffMs ?? 500) * 2 ** i);
      }
    }
    if (last?.code === "provider_unavailable") break;
  }

  if (cfg.cloud?.enabled && !cfg.cloud.first) {
    if (!ctx.cloudConsent && !cfg.cloud.assumeConsent) throw new AiError("cloud_not_permitted", "Local AI unavailable and cloud processing was not consented", false);
    attempts++;
    return { ...(await cfg.cloud.provider.generate(cfg.cloud.model, req)), attempts };
  }
  throw last ?? new AiError("provider_unavailable", "No AI model configured", false);
}

/** Safe, user-facing message for any AI failure (acceptance workflow I). Never leaks internals. */
export function userFacingAiError(e: unknown): { code: string; message: string; canRetry: boolean } {
  const err = e instanceof AiError ? e : new AiError("unknown", "unknown", false);
  const messages: Record<string, string> = {
    provider_unavailable: "The AI writing assistant is temporarily unavailable. Your data is safe — you can keep editing and try again later.",
    timeout: "The AI assistant took too long to respond. Please try again.",
    invalid_output: "The AI assistant returned an unusable answer. Please try again.",
    unverified_facts: "The AI suggestion included details that aren't in your profile, so we didn't show it. Try again, or add more detail to your profile first.",
    model_missing: "The AI assistant is being updated. Please try again later.",
    cloud_not_permitted: "The local AI assistant is unavailable. Cloud processing is off unless you allow it in Privacy settings.",
    quota_exceeded: "You have reached your AI usage limit for this period.",
    unknown: "Something went wrong with the AI assistant. Please try again.",
  };
  if (err.message === "nothing_found") return { code: "nothing_found", message: "We couldn't find resume details in that file. Try a text-based PDF or Word file (not a scan or photo).", canRetry: false };
  if (err.message === "unverified_facts") return { code: "unverified_facts", message: messages.unverified_facts!, canRetry: true };
  return { code: err.code, message: messages[err.code]!, canRetry: err.retryable || err.code === "provider_unavailable" };
}
