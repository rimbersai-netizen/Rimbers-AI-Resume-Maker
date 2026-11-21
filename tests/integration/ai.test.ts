/**
 * Phase 7B AI pipeline on LOCAL Supabase: queue → ai-worker → (fake / dead / live Ollama) → output + usage.
 * Run: SUPABASE_IT=1 pnpm vitest run tests/integration/ai.test.ts   (+ OLLAMA_LIVE=1 for the real-model case)
 */
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OllamaProvider, type AiProvider } from "../../packages/ai-engine/src/index";
import { defaultDeps, runOnce, type WorkerDeps } from "../../services/ai-worker/src/index";

const enabled = process.env.SUPABASE_IT === "1";
let env: { API_URL: string; ANON_KEY: string; SERVICE_ROLE_KEY: string };
let admin: SupabaseClient;
const users: string[] = [];
const PW = `Aa1-${Math.random().toString(36).slice(2)}xyz`;
const run = Date.now();

async function user(tag: string) {
  const email = `ai-${tag}-${run}@test.local`;
  const { data } = await admin.auth.admin.createUser({ email, password: PW, email_confirm: true });
  users.push(data.user!.id);
  const c = createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email, password: PW });
  const uid = data.user!.id;
  const { data: mp } = await c.from("master_profiles").insert({ user_id: uid, is_primary: true }).select("id").single();
  await c.rpc("save_master_profile", { p_id: mp!.id, p_data: {
    schemaVersion: 1, personal: { fullName: "Omar Haddad", professionalTitle: "Site Engineer", email: "omar@example.com", location: {} },
    experience: [{ id: randomUUID(), employer: "Al Bina Contracting", title: "Site Engineer", dates: { start: "2019-03", current: true },
      bullets: [{ id: "b1", text: "Supervised construction of 3 residential buildings", provenance: "user" }, { id: "b2", text: "Coordinated subcontractors and inspections", provenance: "user" }] }],
    education: [], skills: [{ id: randomUUID(), name: "AutoCAD" }, { id: randomUUID(), name: "Primavera" }], certifications: [], languages: [], projects: [],
    publications: [], awards: [], volunteer: [], references: [], customSections: [] } });
  return { c, uid, mpId: mp!.id as string };
}
const enqueue = async (u: Awaited<ReturnType<typeof user>>, mpId = u.mpId) => (await u.c.from("ai_jobs").insert({
  user_id: u.uid, kind: "summary", idempotency_key: randomUUID(), input: { masterProfileId: mpId, tone: "professional", length: "short", locale: "en" },
}).select("id").single()).data!.id as string;
const drain = async (deps: WorkerDeps) => { for (let i = 0; i < 20 && (await runOnce(admin, deps)); i++); };

const fake = (summary: string): AiProvider => ({
  name: "fake", isLocal: true, health: async () => ({ ok: true, provider: "fake", models: ["m"] }),
  generate: async (_m, req) => ({ value: req.schema.parse({ summary }), provider: "fake", model: "m", promptTokens: 42, completionTokens: 17, durationMs: 5 }),
});

beforeAll(() => {
  if (!enabled) return;
  env = JSON.parse(execSync("supabase status -o json", { cwd: `${__dirname}/../..` }).toString());
  if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(env.API_URL)) throw new Error("refusing non-local Supabase");
  admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
});
afterAll(async () => { if (enabled) for (const id of users) await admin.auth.admin.deleteUser(id); });

describe.skipIf(!enabled)("AI pipeline", () => {
  it("worker completes a job: output visible to owner only, usage recorded", async () => {
    const a = await user("a");
    const b = await user("b");
    const id = await enqueue(a);
    await drain({ provider: fake("Site Engineer at Al Bina Contracting supervising construction of 3 residential buildings."), route: { localModels: ["m"], sleep: async () => {} } });
    const { data } = await a.c.from("ai_jobs").select("status,output,provider,model").eq("id", id).single();
    expect(data).toMatchObject({ status: "succeeded", provider: "fake", model: "m" });
    expect(data!.output.summary).toContain("3 residential buildings");
    expect((await b.c.from("ai_jobs").select("id").eq("id", id)).data).toEqual([]);
    const { data: usage } = await a.c.from("ai_usage").select("prompt_tokens,completion_tokens,ai_job_id").eq("ai_job_id", id);
    expect(usage).toEqual([{ prompt_tokens: 42, completion_tokens: 17, ai_job_id: id }]);
  });

  it("workflow I: Ollama down → job requeued, then fails with a safe, non-technical message", async () => {
    const a = await user("down");
    const id = await enqueue(a);
    const dead: WorkerDeps = { provider: new OllamaProvider({ baseUrl: "http://127.0.0.1:9" }), route: { localModels: ["qwen3:4b"], sleep: async () => {} } };
    await drain(dead);
    const { data } = await a.c.from("ai_jobs").select("status,error_code,attempts,output").eq("id", id).single();
    expect(data).toMatchObject({ status: "failed", error_code: "provider_unavailable", output: null });
    expect(data!.attempts).toBe(3); // retried up to max_attempts
  });

  it("forged request for another user's profile is rejected by the worker", async () => {
    const a = await user("c");
    const b = await user("d");
    const id = await enqueue(a, b.mpId);
    await drain({ provider: fake("x".repeat(30)), route: { localModels: ["m"], sleep: async () => {} } });
    const { data } = await a.c.from("ai_jobs").select("status,error_code,output").eq("id", id).single();
    expect(data).toMatchObject({ status: "failed", error_code: "not_found", output: null });
  });

  it("clients cannot claim jobs, write outputs, or forge completed jobs; can cancel queued ones", async () => {
    const a = await user("e");
    expect((await a.c.rpc("claim_ai_job", { p_lock_seconds: 1 })).error).not.toBeNull();
    const id = await enqueue(a);
    const forge = await a.c.from("ai_jobs").update({ status: "succeeded", output: { summary: "hacked" } }).eq("id", id).select("id");
    expect(forge.data ?? []).toEqual([]);
    const cancel = await a.c.from("ai_jobs").update({ status: "cancelled" }).eq("id", id).select("status");
    expect(cancel.data).toEqual([{ status: "cancelled" }]);
  });

  it.skipIf(process.env.OLLAMA_LIVE !== "1")("live local model produces a fact-checked summary", async () => {
    const a = await user("live");
    const id = await enqueue(a);
    await drain(defaultDeps());
    const { data } = await a.c.from("ai_jobs").select("status,error_code,output,model").eq("id", id).single();
    console.log("LIVE", JSON.stringify(data));
    expect(["succeeded", "failed"]).toContain(data!.status);
    if (data!.status === "succeeded") expect(data!.output.summary.length).toBeGreaterThan(20);
    else expect(data!.error_code).toBe("unverified_facts"); // model invented facts twice → safely withheld
  }, 600_000);
});
