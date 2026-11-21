/**
 * Phase 12A cover letters end-to-end on LOCAL Supabase: AI job (fake model) → save → PDF/DOCX export via worker.
 * Run: SUPABASE_IT=1 PDF_IT=1 pnpm vitest run tests/integration/cover-letter.test.ts  (+ OLLAMA_LIVE=1 for the live case)
 */
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AiProvider } from "../../packages/ai-engine/src/index";
import { defaultDeps, runOnce as runAi } from "../../services/ai-worker/src/index";
import { closeBrowser, runOnce as runExport } from "../../services/document-worker/src/index";

const enabled = process.env.SUPABASE_IT === "1" && process.env.PDF_IT === "1";
let env: { API_URL: string; ANON_KEY: string; SERVICE_ROLE_KEY: string };
let admin: SupabaseClient;
const users: string[] = [];
const PW = `Aa1-${Math.random().toString(36).slice(2)}xyz`;
const run = Date.now();
const LETTER = "Dear Hiring Manager,\n\nI am applying for the Site Engineer role at Red Sea Builders. At Al Bina Contracting I supervised construction of 3 residential buildings and coordinated subcontractors and inspections.\n\nI use AutoCAD and Primavera every day and would bring careful site supervision to your team.\n\nSincerely,\nOmar Haddad";

async function user(tag: string) {
  const email = `cl-${tag}-${run}@test.local`;
  const { data } = await admin.auth.admin.createUser({ email, password: PW, email_confirm: true });
  users.push(data.user!.id);
  const c = createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email, password: PW });
  const uid = data.user!.id;
  const { data: mp } = await c.from("master_profiles").insert({ user_id: uid, is_primary: true }).select("id").single();
  await c.rpc("save_master_profile", { p_id: mp!.id, p_data: {
    schemaVersion: 1, personal: { fullName: "Omar Haddad", professionalTitle: "Site Engineer", email: "omar@example.com", location: { city: "Jeddah" } },
    experience: [{ id: randomUUID(), employer: "Al Bina Contracting", title: "Site Engineer", dates: { start: "2019-03", current: true },
      bullets: [{ id: "b1", text: "Supervised construction of 3 residential buildings", provenance: "user" }, { id: "b2", text: "Coordinated subcontractors and inspections", provenance: "user" }] }],
    education: [], skills: [{ id: randomUUID(), name: "AutoCAD" }, { id: randomUUID(), name: "Primavera" }], certifications: [], languages: [], projects: [],
    publications: [], awards: [], volunteer: [], references: [], customSections: [] } });
  return { c, uid, mpId: mp!.id as string };
}
const fake: AiProvider = {
  name: "fake", isLocal: true, health: async () => ({ ok: true, provider: "fake", models: ["m"] }),
  generate: async (_m, req) => ({ value: req.schema.parse({ letter: LETTER }), provider: "fake", model: "m", promptTokens: 1, completionTokens: 1, durationMs: 1 }),
};

beforeAll(() => {
  if (!enabled) return;
  env = JSON.parse(execSync("supabase status -o json", { cwd: `${__dirname}/../..` }).toString());
  if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(env.API_URL)) throw new Error("refusing non-local Supabase");
  admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
});
afterAll(async () => { if (!enabled) return; await closeBrowser(); for (const id of users) await admin.auth.admin.deleteUser(id); });

describe.skipIf(!enabled)("cover letters", () => {
  it("AI letter job → saved letter → PDF and DOCX exports, owner-only", async () => {
    const a = await user("a");
    const b = await user("b");
    const job = (await a.c.from("ai_jobs").insert({ user_id: a.uid, kind: "cover_letter", idempotency_key: randomUUID(),
      input: { masterProfileId: a.mpId, locale: "en", tone: "professional", jobTitle: "Site Engineer", company: "Red Sea Builders" } }).select("id").single()).data!.id;
    for (let i = 0; i < 10 && (await runAi(admin, { provider: fake, route: { localModels: ["m"], sleep: async () => {} } })); i++);
    const { data: j } = await a.c.from("ai_jobs").select("status,output").eq("id", job).single();
    expect(j).toMatchObject({ status: "succeeded", output: { kind: "cover_letter" } });

    const { data: cl } = await a.c.from("cover_letters").insert({ user_id: a.uid, title: "Site Engineer", body: j!.output.letter, locale: "en", page_size: "A4", company: "Red Sea Builders" }).select("id").single();
    const ids: string[] = [];
    for (const format of ["pdf", "docx"]) ids.push((await a.c.from("document_exports").insert({ user_id: a.uid, cover_letter_id: cl!.id, format }).select("id").single()).data!.id);
    for (let i = 0; i < 10 && (await runExport(admin)); i++);
    const { data: rows } = await a.c.from("document_exports").select("id,status,storage_path,format").in("id", ids);
    for (const r of rows!) {
      expect(r.status).toBe("succeeded");
      expect(r.storage_path).toMatch(new RegExp(`^${a.uid}/letters/${cl!.id}/.*\\.${r.format}$`));
      const signed = await a.c.storage.from("resume-exports").createSignedUrl(r.storage_path!, 60);
      const bytes = Buffer.from(await (await fetch(signed.data!.signedUrl)).arrayBuffer());
      expect(bytes.subarray(0, 2).toString()).toBe(r.format === "pdf" ? "%P" : "PK");
      expect((await b.c.storage.from("resume-exports").createSignedUrl(r.storage_path!, 60)).data).toBeNull();
    }
    expect((await b.c.from("cover_letters").select("id").eq("id", cl!.id)).data).toEqual([]);
  }, 60_000);

  it.skipIf(process.env.OLLAMA_LIVE !== "1")("live local model writes a fact-checked cover letter", async () => {
    const a = await user("live");
    const job = (await a.c.from("ai_jobs").insert({ user_id: a.uid, kind: "cover_letter", idempotency_key: randomUUID(),
      input: { masterProfileId: a.mpId, locale: "en", tone: "professional", jobTitle: "Senior Site Engineer", company: "Red Sea Builders",
        jobDescription: "Requirements:\n- AutoCAD\n- Revit and BIM\n- Supervise residential construction" } }).select("id").single()).data!.id;
    for (let i = 0; i < 5 && (await runAi(admin, defaultDeps())); i++);
    const { data } = await a.c.from("ai_jobs").select("status,error_code,output").eq("id", job).single();
    console.log("LIVE-LETTER", JSON.stringify(data));
    if (data!.status === "succeeded") { expect(data!.output.letter).not.toMatch(/revit|bim/i); expect(data!.output.letter).toMatch(/Omar Haddad/); }
    else expect(data!.error_code).toBe("unverified_facts");
  }, 600_000);
});
