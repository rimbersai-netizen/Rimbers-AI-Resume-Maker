/**
 * Phase 3 master-profile integration tests through the real API (PostgREST RPC) on LOCAL Supabase.
 * Run: SUPABASE_IT=1 pnpm vitest run tests/integration/profile.test.ts
 */
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prepareForSave } from "../../apps/web/src/lib/profile-draft";

const enabled = process.env.SUPABASE_IT === "1";
let env: { API_URL: string; ANON_KEY: string; SERVICE_ROLE_KEY: string };
let admin: SupabaseClient;
const users: string[] = [];
const PW = `Aa1-${Math.random().toString(36).slice(2)}xyz`;
const run = Date.now();

async function signedIn(tag: string) {
  const email = `prof-${tag}-${run}@test.local`;
  const { data } = await admin.auth.admin.createUser({ email, password: PW, email_confirm: true });
  users.push(data.user!.id);
  const c = createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email, password: PW });
  const { data: mp } = await c.from("master_profiles").insert({ user_id: data.user!.id, is_primary: true }).select("id").single();
  return { c, uid: data.user!.id, pid: mp!.id as string };
}

const draft = () => ({
  schemaVersion: 1,
  personal: { fullName: "Lee Min", email: "lee@example.com", location: { city: "Seoul", country: "KR" }, website: "" },
  summary: "Engineer.",
  experience: [{ id: randomUUID(), employer: "Acme", title: "Engineer", dates: { start: "2020-01", current: true }, bullets: [{ id: "b1", text: "Built APIs", provenance: "user" }, { id: "b2", text: " ", provenance: "user" }] }],
  education: [], skills: [{ id: randomUUID(), name: "Go" }], certifications: [], languages: [], projects: [],
  publications: [], awards: [], volunteer: [], references: [], customSections: [],
});

beforeAll(() => {
  if (!enabled) return;
  env = JSON.parse(execSync("supabase status -o json", { cwd: `${__dirname}/../..` }).toString());
  if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(env.API_URL)) throw new Error("refusing non-local Supabase");
  admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
});
afterAll(async () => { if (enabled) for (const id of users) await admin.auth.admin.deleteUser(id); });

describe.skipIf(!enabled)("master profile via API", () => {
  it("save (validated by the same prepareForSave the web app uses) → load round-trips", async () => {
    const { c, pid } = await signedIn("a");
    const prepared = prepareForSave(draft());
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const saved = await c.rpc("save_master_profile", { p_id: pid, p_data: prepared.profile });
    expect(saved.error).toBeNull();
    const loaded = await c.rpc("get_master_profile", { p_id: pid });
    expect(loaded.data.profile.personal.fullName).toBe("Lee Min");
    expect(loaded.data.profile.personal.website).toBeUndefined();
    expect(loaded.data.profile.experience[0].bullets).toHaveLength(1);
    expect(loaded.data.meta.updatedAt).toBe(saved.data.updatedAt);
  });

  it("stale updatedAt → 40001 conflict; current updatedAt → ok", async () => {
    const { c, pid } = await signedIn("b");
    const p = (prepareForSave(draft()) as { ok: true; profile: unknown }).profile;
    const first = await c.rpc("save_master_profile", { p_id: pid, p_data: p });
    const stale = await c.rpc("save_master_profile", { p_id: pid, p_data: p, p_expected_updated_at: "2000-01-01T00:00:00Z" });
    expect(stale.error?.code).toBe("40001");
    const fresh = await c.rpc("save_master_profile", { p_id: pid, p_data: p, p_expected_updated_at: first.data.updatedAt });
    expect(fresh.error).toBeNull();
  });

  it("other users and anonymous callers cannot read or write", async () => {
    const a = await signedIn("c");
    const b = await signedIn("d");
    const p = (prepareForSave(draft()) as { ok: true; profile: unknown }).profile;
    await a.c.rpc("save_master_profile", { p_id: a.pid, p_data: p });
    expect((await b.c.rpc("get_master_profile", { p_id: a.pid })).data).toBeNull();
    expect((await b.c.rpc("save_master_profile", { p_id: a.pid, p_data: p })).error?.code).toBe("P0002");
    const anon = createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false } });
    const r = await anon.rpc("get_master_profile", { p_id: a.pid });
    expect(r.error).not.toBeNull();
  });

  it("versions are private and listable by the owner", async () => {
    const a = await signedIn("e");
    const b = await signedIn("f");
    const p = (prepareForSave(draft()) as { ok: true; profile: unknown }).profile;
    const s = await a.c.rpc("save_master_profile", { p_id: a.pid, p_data: p, p_snapshot_label: "v1" });
    expect(s.data.version).toBe(1);
    expect((await a.c.from("master_profile_versions").select("id")).data).toHaveLength(1);
    expect((await b.c.from("master_profile_versions").select("id")).data).toHaveLength(0);
  });
});
