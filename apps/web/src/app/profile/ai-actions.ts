"use server";

import { createClient } from "@/lib/supabase/server";
import { cancelAi, getAiJobState, requestAi, type AiJobState, type AiRequestResult } from "@/lib/services/ai";

export type { AiJobState, AiRequestResult };

/** Queue an AI writing job (server-side quota). The AI worker runs it on the local model. */
export async function requestAiSuggestion(input: unknown): Promise<AiRequestResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  return requestAi(supabase, user, input);
}

export async function getAiJob(jobId: string): Promise<AiJobState | null> {
  return getAiJobState(await createClient(), jobId);
}

export async function cancelAiJob(jobId: string): Promise<void> {
  await cancelAi(await createClient(), jobId);
}
