"use server";

import { z } from "zod";
import { SUPPORTED_LOCALES } from "@gars/shared-types";
import { createClient } from "@/lib/supabase/server";
import { entitlement, PLAN_NAMES } from "@/lib/entitlements";

const LetterFields = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().max(20000),
  locale: z.enum(SUPPORTED_LOCALES),
  pageSize: z.enum(["A4", "Letter"]),
  jobTitle: z.string().trim().max(200).optional(),
  company: z.string().trim().max(200).optional(),
  resumeId: z.string().uuid().optional(),
});
export type LetterFields = z.infer<typeof LetterFields>;
type R<T = object> = ({ ok: true } & T) | { ok: false; message: string; upgrade?: boolean };

async function ctx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function createCoverLetter(input: LetterFields): Promise<R<{ id: string }>> {
  const p = LetterFields.safeParse(input);
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? "Invalid letter" };
  const { supabase, user } = await ctx();
  if (!user) return { ok: false, message: "Please sign in again." };
  const { data, error } = await supabase.from("cover_letters").insert({
    user_id: user.id, title: p.data.title, body: p.data.body, locale: p.data.locale, page_size: p.data.pageSize,
    job_title: p.data.jobTitle ?? null, company: p.data.company ?? null, resume_id: p.data.resumeId ?? null,
  }).select("id").single();
  if (error || !data) return { ok: false, message: "Could not save the cover letter." };
  return { ok: true, id: data.id };
}

export async function saveCoverLetter(id: string, input: LetterFields): Promise<R> {
  const p = LetterFields.safeParse(input);
  if (!p.success || !z.string().uuid().safeParse(id).success) return { ok: false, message: "Invalid letter" };
  const { supabase, user } = await ctx();
  if (!user) return { ok: false, message: "Please sign in again." };
  const { error, count } = await supabase.from("cover_letters").update({
    title: p.data.title, body: p.data.body, locale: p.data.locale, page_size: p.data.pageSize,
    job_title: p.data.jobTitle ?? null, company: p.data.company ?? null, resume_id: p.data.resumeId ?? null,
  }, { count: "exact" }).eq("id", id);
  return error || !count ? { ok: false, message: "Could not save." } : { ok: true };
}

export async function deleteCoverLetter(id: string): Promise<R> {
  const { supabase, user } = await ctx();
  if (!user || !z.string().uuid().safeParse(id).success) return { ok: false, message: "Invalid request" };
  const { error } = await supabase.from("cover_letters").delete().eq("id", id);
  return error ? { ok: false, message: "Could not delete." } : { ok: true };
}

export async function requestLetterExport(id: string, format: "pdf" | "docx"): Promise<R<{ exportId: string }>> {
  const { supabase, user } = await ctx();
  if (!user || !z.string().uuid().safeParse(id).success) return { ok: false, message: "Invalid request" };
  const q = await entitlement(supabase, format === "docx" ? "export_docx" : "export_pdf");
  if (!q.allowed) {
    return { ok: false, upgrade: true, message: q.reason === "plan_feature"
      ? `Editable Word (DOCX) downloads are included from the ${q.upgradeTo ? PLAN_NAMES[q.upgradeTo] : "Standard"} plan.`
      : `You have used this month's downloads on the ${q.plan === "FREE" ? "Free" : q.plan} plan.${q.upgradeTo ? ` Upgrade to ${PLAN_NAMES[q.upgradeTo]} for more.` : ""}` };
  }
  const { data, error } = await supabase.from("document_exports").insert({ user_id: user.id, cover_letter_id: id, format }).select("id").single();
  return error || !data ? { ok: false, message: "Could not start the export." } : { ok: true, exportId: data.id };
}

export async function getLetterExport(exportId: string): Promise<{ status: string; url?: string; message?: string } | null> {
  const { supabase, user } = await ctx();
  if (!user || !z.string().uuid().safeParse(exportId).success) return null;
  const { data } = await supabase.from("document_exports").select("status,storage_path,format,cover_letter_id").eq("id", exportId).maybeSingle();
  if (!data) return null;
  if (data.status === "failed") return { status: "failed", message: "The export failed. Please try again." };
  if (data.status !== "succeeded" || !data.storage_path) return { status: data.status };
  const { data: cl } = await supabase.from("cover_letters").select("title").eq("id", data.cover_letter_id!).maybeSingle();
  const name = `${(cl?.title ?? "cover-letter").replace(/[^\p{L}\p{N} _-]+/gu, "").trim().slice(0, 80) || "cover-letter"} - cover letter.${data.format}`;
  const { data: signed } = await supabase.storage.from("resume-exports").createSignedUrl(data.storage_path, 300, { download: name });
  return { status: "succeeded", url: signed?.signedUrl };
}
