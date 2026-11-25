"use server";

import { createClient } from "@/lib/supabase/server";
import { getAiJobState, type AiJobState, type AiRequestResult } from "@/lib/services/ai";
import { applyResumeImport, startResumeImport, type ApplyResult } from "@/lib/services/resume-import";

/** Upload a PDF/Word resume: its text is read on the server, then the AI worker extracts the details. */
export async function startImport(form: FormData): Promise<AiRequestResult> {
  const file = form.get("file");
  if (!(file instanceof File)) return { ok: false, message: "Choose a PDF or Word file." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  return startResumeImport(supabase, user, { name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) });
}

export async function importStatus(jobId: string): Promise<AiJobState | null> {
  return getAiJobState(await createClient(), jobId);
}

/** Save the reviewed import as the profile. `replace` takes the resume's data; otherwise only empty parts are filled. */
export async function applyImport(jobId: string, replace: boolean): Promise<ApplyResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, kind: "auth", message: "Please sign in again." };
  return applyResumeImport(supabase, user, jobId, replace ? "replace" : "fill");
}
