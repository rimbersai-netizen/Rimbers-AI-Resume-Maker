import type { SupabaseClient, User } from "@supabase/supabase-js";
import { AiJobOutput, IMPORT_MAX_CHARS } from "@gars/ai-engine";
import { z } from "zod";
import { requestAi, type AiRequestResult } from "./ai";
import { loadPrimaryProfileCore, saveProfileCore, type SaveResult } from "./profile";
import { cleanEmpty, toDraft, type Draft } from "../profile-draft";

export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;

export interface UploadedFile { name: string; type: string; bytes: Uint8Array }

export type Extracted = { ok: true; text: string } | { ok: false; message: string };

const tidy = (t: string) => t.replace(/\r\n?/g, "\n").replace(/[ \t ]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

/** Text of a PDF / DOCX / TXT upload. Scanned images have no text layer and are reported honestly instead of guessed at. */
export async function extractResumeText(file: UploadedFile): Promise<Extracted> {
  if (file.bytes.byteLength === 0) return { ok: false, message: "That file is empty." };
  if (file.bytes.byteLength > IMPORT_MAX_BYTES) return { ok: false, message: "That file is too large (max 5 MB)." };
  const name = file.name.toLowerCase();
  const isPdf = file.type === "application/pdf" || name.endsWith(".pdf") || startsWith(file.bytes, "%PDF");
  const isDocx = name.endsWith(".docx") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || startsWith(file.bytes, "PK");
  try {
    let text: string;
    if (isPdf) {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(file.bytes));
      text = (await extractText(pdf, { mergePages: true })).text as string;
    } else if (isDocx) {
      const mammoth = await import("mammoth");
      text = (await mammoth.extractRawText({ buffer: Buffer.from(file.bytes) })).value;
    } else if (name.endsWith(".txt") || name.endsWith(".md") || file.type.startsWith("text/")) {
      text = new TextDecoder("utf-8").decode(file.bytes);
    } else {
      return { ok: false, message: "Upload a PDF or Word (.docx) file." };
    }
    text = tidy(text);
    if (text.length < 80) return { ok: false, message: "We couldn't read any text in that file. If it's a scan or photo, upload a text-based PDF or Word file instead." };
    return { ok: true, text: text.slice(0, IMPORT_MAX_CHARS) };
  } catch {
    return { ok: false, message: "We couldn't open that file. Make sure it isn't password-protected or damaged." };
  }
}

function startsWith(b: Uint8Array, s: string) { return s.split("").every((c, i) => b[i] === c.charCodeAt(0)); }

/** Extract text, then queue the AI extraction (server-side quota applies). */
export async function startResumeImport(supabase: SupabaseClient, user: User, file: UploadedFile, locale = "en"): Promise<AiRequestResult> {
  const x = await extractResumeText(file);
  if (!x.ok) return { ok: false, message: x.message };
  return requestAi(supabase, user, { kind: "import_extract", locale, text: x.text });
}

export type ApplyResult = SaveResult | { ok: false; kind: "not_ready" | "no_name"; message: string };

const nonEmpty = (v: unknown) => (typeof v === "string" ? v.trim() !== "" : v !== undefined && v !== null);

/** Merge: fill only what the profile lacks. Replace: take the imported data, but keep photo and work-authorization (never in a CV import). */
export function mergeImported(current: Draft, imported: Draft, mode: "replace" | "fill"): Draft {
  if (mode === "replace") {
    return { ...imported, personal: { ...imported.personal, fullName: imported.personal.fullName || current.personal.fullName, photoPath: current.personal.photoPath, workAuthorization: current.personal.workAuthorization } };
  }
  const personal = { ...current.personal } as Record<string, unknown>;
  for (const [k, v] of Object.entries(imported.personal)) if (k !== "location" && !nonEmpty(personal[k]) && nonEmpty(v)) personal[k] = v;
  personal.location = { ...imported.personal.location, ...cleanEmpty(current.personal.location ?? {}) };
  const pick = <K extends keyof Draft>(k: K): Draft[K] => ((current[k] as unknown[]).length ? current[k] : imported[k]) as Draft[K];
  return {
    ...current, personal: personal as Draft["personal"], summary: nonEmpty(current.summary) ? current.summary : imported.summary,
    experience: pick("experience"), education: pick("education"), skills: pick("skills"), certifications: pick("certifications"), languages: pick("languages"), projects: pick("projects"),
  };
}

/** Save the finished import job's profile as the user's master profile (previous version is kept as a snapshot). */
export async function applyResumeImport(supabase: SupabaseClient, user: User, jobId: string, mode: "replace" | "fill"): Promise<ApplyResult> {
  if (!z.string().uuid().safeParse(jobId).success) return { ok: false, kind: "not_ready", message: "Import not found." };
  const { data } = await supabase.from("ai_jobs").select("status,output,kind").eq("id", jobId).maybeSingle();
  if (!data || data.kind !== "import_extract" || data.status !== "succeeded") return { ok: false, kind: "not_ready", message: "The import isn't finished yet." };
  const out = AiJobOutput.safeParse(data.output);
  if (!out.success || out.data.kind !== "imported_profile") return { ok: false, kind: "not_ready", message: "The import result is unusable. Please upload the file again." };
  const loaded = await loadPrimaryProfileCore(supabase, user).catch(() => null);
  if (!loaded) return { ok: false, kind: "error", message: "Could not load your profile." };
  const merged = mergeImported(loaded.profile, toDraft(out.data.profile), mode);
  if (!merged.personal.fullName.trim()) return { ok: false, kind: "no_name", message: "We couldn't find your name in that file. Add your name in your profile, then import again." };
  return saveProfileCore(supabase, loaded.id, merged, loaded.updatedAt, "Imported from CV");
}
