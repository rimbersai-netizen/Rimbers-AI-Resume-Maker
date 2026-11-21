"use server";

import { z } from "zod";
import type { AnalysisResult } from "@gars/ats-engine";
import { createClient } from "@/lib/supabase/server";

/** Record a job description + ATS analysis for history (RLS: own rows; composite FKs tie them to the resume). */
export async function saveAtsAnalysis(resumeId: string, jd: { title?: string; body: string }, result: AnalysisResult): Promise<{ ok: boolean }> {
  if (!z.string().uuid().safeParse(resumeId).success || jd.body.length > 20000) return { ok: false };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { data: jdRow } = await supabase.from("job_descriptions")
    .insert({ user_id: user.id, title: jd.title?.slice(0, 200) || null, body: jd.body }).select("id").single();
  const { error } = await supabase.from("ats_results").insert({
    user_id: user.id, resume_id: resumeId, job_description_id: jdRow?.id ?? null,
    overall_score: result.overall, categories: result.categories, engine_version: result.engineVersion,
  });
  return { ok: !error };
}
