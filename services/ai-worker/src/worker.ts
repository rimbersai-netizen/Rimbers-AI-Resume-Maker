/**
 * AI job processing (service role). Local Ollama first; cloud never used unless configured AND consented per job.
 * The service role bypasses RLS, so ownership of the referenced profile is checked explicitly.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { AiError, AiJobInput, GeminiProvider, OllamaProvider, runAiJob, userFacingAiError, type AiProvider, type RouteConfig } from "@gars/ai-engine";
import { MasterProfile } from "@gars/resume-schema";

export interface AiJobRow { id: string; user_id: string; kind: string; input: unknown; attempts: number; max_attempts: number; cloud_consent: boolean }

export interface WorkerDeps {
  provider: AiProvider;
  route: RouteConfig;
}

export function defaultDeps(): WorkerDeps {
  // Gemini is used only when an operator sets BOTH a key and AI_PROVIDER=gemini (resume content then goes to Google).
  const gemini = process.env.GEMINI_API_KEY && process.env.AI_PROVIDER === "gemini"
    ? { provider: new GeminiProvider({ apiKey: process.env.GEMINI_API_KEY, fallbackModels: (process.env.GEMINI_FALLBACK_MODELS ?? "gemini-3.1-flash-lite,gemini-3.7-flash").split(",").map((m) => m.trim()).filter(Boolean) }), model: process.env.GEMINI_MODEL ?? "gemini-flash-latest", enabled: true, first: true, assumeConsent: true }
    : undefined;
  return {
    provider: new OllamaProvider({ baseUrl: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434" }),
    route: {
      localModels: (process.env.AI_MODELS ?? "qwen3:4b,llama3.2:3b").split(",").map((s) => s.trim()).filter(Boolean),
      maxAttempts: 2,
      backoffMs: 1000,
      // Cloud stays disabled unless the operator opted in above; otherwise users must consent per request.
      cloud: gemini,
    },
  };
}

export async function processAiJob(db: SupabaseClient, job: AiJobRow, deps: WorkerDeps): Promise<{ ok: boolean; code?: string }> {
  const parsed = AiJobInput.safeParse({ kind: job.kind, ...(job.input as object) });
  const finish = async (fields: Record<string, unknown>) => { await db.from("ai_jobs").update({ ...fields, locked_at: null, completed_at: new Date().toISOString() }).eq("id", job.id); };
  if (!parsed.success) { await finish({ status: "failed", error_code: "invalid_input" }); return { ok: false, code: "invalid_input" }; }
  const input = parsed.data;

  const { data: mp } = await db.from("master_profiles").select("id,user_id").eq("id", input.masterProfileId).maybeSingle();
  if (!mp || mp.user_id !== job.user_id) { await finish({ status: "failed", error_code: "not_found" }); return { ok: false, code: "not_found" }; }
  const { data: loaded } = await db.rpc("get_master_profile", { p_id: input.masterProfileId });
  const profile = MasterProfile.safeParse(loaded?.profile);
  if (!profile.success) { await finish({ status: "failed", error_code: "profile_incomplete" }); return { ok: false, code: "profile_incomplete" }; }

  try {
    const r = await runAiJob(input, profile.data, deps.provider, deps.route, { cloudConsent: job.cloud_consent });
    await finish({ status: "succeeded", output: r.output, provider: r.provider, model: r.model, error_code: null });
    await db.from("ai_usage").insert({
      user_id: job.user_id, ai_job_id: job.id, provider: r.provider, model: r.model,
      prompt_tokens: r.promptTokens, completion_tokens: r.completionTokens, duration_ms: r.durationMs, cost_usd_micros: 0,
    });
    return { ok: true };
  } catch (e) {
    // Non-AI errors come from request planning (e.g. nothing to polish) → invalid_input, not a model failure.
    const code = e instanceof AiError ? userFacingAiError(e).code : "invalid_input";
    // Service down / timeout: requeue while attempts remain; otherwise fail with a safe code the UI can explain.
    const retry = e instanceof AiError && (e.code === "provider_unavailable" || e.code === "timeout") && job.attempts < job.max_attempts;
    if (retry) await db.from("ai_jobs").update({ status: "queued", locked_at: null, error_code: code }).eq("id", job.id);
    else await finish({ status: "failed", error_code: code });
    return { ok: false, code };
  }
}

export async function runOnce(db: SupabaseClient, deps: WorkerDeps): Promise<boolean> {
  const { data, error } = await db.rpc("claim_ai_job", { p_lock_seconds: 300 });
  if (error) throw new Error(`claim failed: ${error.message}`);
  const job = (data as AiJobRow[] | null)?.[0];
  if (!job) return false;
  await processAiJob(db, job, deps);
  return true;
}
