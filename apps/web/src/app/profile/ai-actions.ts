"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AiJobInput, AiJobOutput, AiError, userFacingAiError } from "@gars/ai-engine";
import { createClient } from "@/lib/supabase/server";
import { entitlement, PLAN_NAMES } from "@/lib/entitlements";

export type AiRequestResult = { ok: true; jobId: string } | { ok: false; message: string; upgrade?: boolean };
export type AiJobState =
  | { status: "queued" | "running" }
  | { status: "succeeded"; output: AiJobOutput }
  | { status: "failed" | "cancelled"; message: string; canRetry: boolean };

/** Queue an AI writing job (server-side quota). The AI worker runs it on the local model. */
export async function requestAiSuggestion(input: AiJobInput): Promise<AiRequestResult> {
  const parsed = AiJobInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid request." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const quota = await entitlement(supabase, "ai_request");
  if (!quota.allowed) {
    return { ok: false, upgrade: true, message: `You've used this month's AI requests on the ${quota.plan === "FREE" ? "Free" : quota.plan} plan.${quota.upgradeTo ? ` Upgrade to ${PLAN_NAMES[quota.upgradeTo]} for more.` : ""}` };
  }
  const { kind, ...rest } = parsed.data;
  const { data, error } = await supabase.from("ai_jobs").insert({ user_id: user.id, kind, input: rest, idempotency_key: randomUUID() }).select("id").single();
  if (error || !data) return { ok: false, message: "Could not start the AI assistant. Please try again." };
  return { ok: true, jobId: data.id };
}

export async function getAiJob(jobId: string): Promise<AiJobState | null> {
  if (!z.string().uuid().safeParse(jobId).success) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("ai_jobs").select("status,output,error_code").eq("id", jobId).maybeSingle();
  if (!data) return null;
  if (data.status === "queued" || data.status === "running") return { status: data.status };
  if (data.status === "succeeded") {
    const out = AiJobOutput.safeParse(data.output);
    return out.success ? { status: "succeeded", output: out.data } : { status: "failed", message: "The AI assistant returned an unusable answer.", canRetry: true };
  }
  const code = data.error_code ?? "unknown";
  const ui = code === "unverified_facts" ? userFacingAiError(new AiError("invalid_output", "unverified_facts", false))
    : code === "profile_incomplete" ? { message: "Complete and save your profile first (name is required).", canRetry: false }
    : userFacingAiError(new AiError(code as never, code, code === "timeout" || code === "provider_unavailable"));
  return { status: data.status === "cancelled" ? "cancelled" : "failed", message: ui.message, canRetry: ui.canRetry };
}

export async function cancelAiJob(jobId: string): Promise<void> {
  if (!z.string().uuid().safeParse(jobId).success) return;
  const supabase = await createClient();
  await supabase.from("ai_jobs").update({ status: "cancelled" }).eq("id", jobId).eq("status", "queued");
}
