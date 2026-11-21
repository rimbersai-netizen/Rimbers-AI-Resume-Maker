/**
 * Phase 10A end-to-end export: queue → worker (service role) → Chromium PDF → private storage → owner-only download.
 * Run: SUPABASE_IT=1 PDF_IT=1 pnpm vitest run tests/integration/export.test.ts
 */
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeBrowser, runOnce } from "../../services/document-worker/src/index";

const enabled = process.env.SUPABASE_IT === "1" && process.env.PDF_IT === "1";
let env: { API_URL: string; ANON_KEY: string; SERVICE_ROLE_KEY: string };
let admin: SupabaseClient;
const users: string[] = [];
const PW = `Aa1-${Math.random().toString(36).slice(2)}xyz`;
const run = Date.now();

async function userWithResume(tag: string) {
  const email = `exp-${tag}-${run}@test.local`;
  const { data } = await admin.auth.admin.createUser({ email, password: PW, email_confirm: true });
  users.push(data.user!.id);
  const c = createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email, password: PW });
  const uid = data.user!.id;
  const { data: mp } = await c.from("master_profiles").insert({ user_id: uid, is_primary: true }).select("id").single();
  await c.rpc("save_master_profile", { p_id: mp!.id, p_data: {
    schemaVersion: 1, summary: "Civil engineer.", personal: { fullName: "Omar Haddad", email: "omar@example.com", location: {} },
    experience: [{ id: randomUUID(), employer: "Al Bina", title: "Site Engineer", dates: { start: "2019-03", current: true }, bullets: [{ id: "b", text: "Supervised 3 buildings", provenance: "user" }] }],
    education: [], skills: [{ id: randomUUID(), name: "AutoCAD" }], certifications: [], languages: [], projects: [],
    publications: [], awards: [], volunteer: [], references: [], customSections: [] } });
  const { data: doc } = await c.from("resume_documents").insert({ user_id: uid, master_profile_id: mp!.id, title: "CV", country_code: "SA", locale: "ar", template_id: "corporate-01", page_size: "A4" }).select("id").single();
  await c.rpc("save_resume_layout", { p_id: doc!.id, p_layout: { sections: [{ key: "summary" }, { key: "experience" }, { key: "skills" }] } });
  return { c, uid, resumeId: doc!.id as string };
}

beforeAll(() => {
  if (!enabled) return;
  env = JSON.parse(execSync("supabase status -o json", { cwd: `${__dirname}/../..` }).toString());
  if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(env.API_URL)) throw new Error("refusing non-local Supabase");
  admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
});
afterAll(async () => {
  if (!enabled) return;
  await closeBrowser();
  for (const id of users) await admin.auth.admin.deleteUser(id);
});

describe.skipIf(!enabled)("export pipeline", () => {
  it("queued export is rendered by the worker, stored privately, downloadable only by the owner", async () => {
    const a = await userWithResume("a");
    const b = await userWithResume("b");
    // client may only enqueue (RLS: status queued, no path)
    const forged = await a.c.from("document_exports").insert({ user_id: a.uid, resume_id: a.resumeId, format: "pdf", status: "succeeded" });
    expect(forged.error).not.toBeNull();
    const { data: job, error } = await a.c.from("document_exports").insert({ user_id: a.uid, resume_id: a.resumeId, format: "pdf" }).select("id").single();
    expect(error).toBeNull();

    // drain the queue (other tests' jobs may be present)
    for (let i = 0; i < 10 && (await runOnce(admin)); i++);
    const { data: row } = await a.c.from("document_exports").select("status,storage_path,error").eq("id", job!.id).single();
    expect(row).toMatchObject({ status: "succeeded" });
    expect(row!.storage_path).toBe(`${a.uid}/${a.resumeId}/${job!.id}.pdf`);

    const signed = await a.c.storage.from("resume-exports").createSignedUrl(row!.storage_path!, 60);
    const res = await fetch(signed.data!.signedUrl);
    const bytes = Buffer.from(await res.arrayBuffer());
    expect(res.status).toBe(200);
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");

    expect((await b.c.storage.from("resume-exports").createSignedUrl(row!.storage_path!, 60)).data).toBeNull();
    expect((await b.c.from("document_exports").select("id").eq("id", job!.id)).data).toEqual([]);
  }, 60_000);

  it("a job for a deleted resume fails cleanly with a recorded error", async () => {
    const a = await userWithResume("c");
    const { data: job } = await a.c.from("document_exports").insert({ user_id: a.uid, resume_id: a.resumeId, format: "pdf" }).select("id").single();
    await a.c.from("resume_documents").update({ deleted_at: new Date().toISOString() }).eq("id", a.resumeId);
    for (let i = 0; i < 10 && (await runOnce(admin)); i++);
    const { data: row } = await a.c.from("document_exports").select("status,error,storage_path").eq("id", job!.id).single();
    expect(row).toMatchObject({ status: "failed", storage_path: null });
    expect(row!.error).toMatch(/not found/);
  }, 60_000);

  it("clients cannot call the claim function", async () => {
    const a = await userWithResume("d");
    expect((await a.c.rpc("claim_document_export", { p_lock_seconds: 1 })).error).not.toBeNull();
  });
});
