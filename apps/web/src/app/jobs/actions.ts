"use server";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/services/resumes";
import {
  applyTailoring, finishTailoring, getFeed, removeFromPipeline, savePrefs, setJobState, tailorAnalysis,
  type PipelineItem, type ScoredJob,
} from "@/lib/services/jobs";

const AUTH: ActionResult<never> = { ok: false, kind: "auth", message: "Please sign in again." } as never;

async function authed() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
}

export async function loadMoreJobs(offset: number): Promise<{ jobs: ScoredJob[]; total: number } | null> {
  const a = await authed();
  if (!a) return null;
  try {
    const f = await getFeed(a.supabase, a.user, { offset, limit: 20 });
    return { jobs: f.jobs, total: f.total };
  } catch { return null; }
}

export async function savePreferences(input: unknown) {
  const a = await authed();
  return a ? savePrefs(a.supabase, a.user, input) : AUTH;
}

export async function setState(key: string, state: string, notes?: string): Promise<ActionResult<{ item: PipelineItem }>> {
  const a = await authed();
  return a ? setJobState(a.supabase, a.user, { key, state, notes }) : (AUTH as never);
}

export async function undoState(id: string): Promise<boolean> {
  const a = await authed();
  return a ? removeFromPipeline(a.supabase, id) : false;
}

export async function analyseJob(key: string) {
  const a = await authed();
  return a ? tailorAnalysis(a.supabase, a.user, key) : AUTH;
}

export async function applySelected(input: unknown) {
  const a = await authed();
  return a ? applyTailoring(a.supabase, a.user, input) : AUTH;
}

export async function finishSummary(resumeId: string, aiJobId: string) {
  const a = await authed();
  return a ? finishTailoring(a.supabase, resumeId, aiJobId) : AUTH;
}
