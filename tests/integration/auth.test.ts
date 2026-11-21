/**
 * Phase 2B auth integration tests against the LOCAL Supabase stack (+ Mailpit for emails).
 * Run: SUPABASE_IT=1 pnpm vitest run tests/integration/auth.test.ts
 */
import { execSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const enabled = process.env.SUPABASE_IT === "1";
type Env = { API_URL: string; ANON_KEY: string; SERVICE_ROLE_KEY: string; MAILPIT_URL?: string; INBUCKET_URL?: string };
let env: Env;
const run = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
const PW = `Aa1-${Math.random().toString(36).slice(2)}xyz`;
const created: string[] = [];

const anonClient = () => createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
let admin: SupabaseClient;

async function latestEmail(to: string): Promise<{ text: string; html: string }> {
  const base = env.MAILPIT_URL ?? env.INBUCKET_URL!;
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`${base}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
    const data = (await res.json()) as { messages?: { ID: string }[] };
    if (data.messages?.length) {
      const m = await (await fetch(`${base}/api/v1/message/${data.messages[0]!.ID}`)).json() as { Text: string; HTML: string };
      return { text: m.Text, html: m.HTML };
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no email for ${to}`);
}
const linkFrom = (m: { text: string; html: string }) => {
  const l = (m.html + m.text).match(/https?:\/\/[^\s"'<>]+\/auth\/v1\/verify\?[^\s"'<>]+/)?.[0];
  if (!l) throw new Error("no verify link");
  return l.replace(/&amp;/g, "&");
};

beforeAll(() => {
  if (!enabled) return;
  env = JSON.parse(execSync("supabase status -o json", { cwd: `${__dirname}/../..` }).toString());
  if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(env.API_URL)) throw new Error("refusing non-local Supabase");
  admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
});
afterAll(async () => {
  if (!enabled) return;
  for (const id of created) await admin.auth.admin.deleteUser(id);
});

describe.skipIf(!enabled)("auth (local Supabase)", () => {
  const email = `it-${run}@test.local`;

  it("sign-up requires email verification (no session before confirming)", async () => {
    const c = anonClient();
    const { data, error } = await c.auth.signUp({ email, password: PW, options: { emailRedirectTo: "http://127.0.0.1:3100/auth/confirm" } });
    expect(error).toBeNull();
    expect(data.session).toBeNull();
    created.push(data.user!.id);
    const r = await anonClient().auth.signInWithPassword({ email, password: PW });
    expect(r.error?.message).toMatch(/not confirmed/i);
  });

  it("weak passwords are rejected by the server policy", async () => {
    const { error } = await anonClient().auth.signUp({ email: `weak-${run}@test.local`, password: "password12" });
    expect(error).not.toBeNull();
  });

  it("verification email link confirms the account; sign-in then works and creates a profile row", async () => {
    const link = linkFrom(await latestEmail(email));
    const res = await fetch(link, { redirect: "manual" });
    expect([302, 303]).toContain(res.status);
    const c = anonClient();
    const { data, error } = await c.auth.signInWithPassword({ email, password: PW });
    expect(error).toBeNull();
    const { data: profile } = await c.from("profiles").select("id, app_locale, app_locale_source").single();
    expect(profile).toMatchObject({ id: data.user!.id, app_locale: "en", app_locale_source: "default" });
  });

  it("password reset sends an email; unknown email gives the same (no error) response", async () => {
    const c = anonClient();
    expect((await c.auth.resetPasswordForEmail(email, { redirectTo: "http://127.0.0.1:3100/auth/confirm?next=/reset-password" })).error).toBeNull();
    expect((await c.auth.resetPasswordForEmail(`nobody-${run}@test.local`)).error).toBeNull();
    const m = await latestEmail(email);
    expect(m.text + m.html).toMatch(/reset|password/i);
  });

  it("guest (anonymous) user can save data, then upgrade keeps the same user id and data", async () => {
    const c = anonClient();
    const { data, error } = await c.auth.signInAnonymously();
    expect(error).toBeNull();
    const id = data.user!.id;
    created.push(id);
    expect(data.user!.is_anonymous).toBe(true);
    const ins = await c.from("master_profiles").insert({ user_id: id, is_primary: true }).select("id").single();
    expect(ins.error).toBeNull();
    const up = await c.auth.updateUser({ email: `guest-${run}@test.local`, password: PW });
    expect(up.error).toBeNull();
    expect(up.data.user!.id).toBe(id);
    const { data: mp } = await c.from("master_profiles").select("id");
    expect(mp?.map((r) => r.id)).toContain(ins.data!.id);
  });

  it("user can request deletion once; second open request is rejected", async () => {
    const c = anonClient();
    const { data } = await c.auth.signInWithPassword({ email, password: PW });
    const first = await c.from("deletion_requests").insert({ user_id: data.user!.id });
    expect(first.error).toBeNull();
    const second = await c.from("deletion_requests").insert({ user_id: data.user!.id });
    expect(second.error?.code).toBe("23505");
    const forged = await c.from("deletion_requests").insert({ user_id: data.user!.id, status: "completed" });
    expect(forged.error).not.toBeNull();
  });

  it("sign-out invalidates the refresh token", async () => {
    const c = anonClient();
    const { data } = await c.auth.signInWithPassword({ email, password: PW });
    const refresh = data.session!.refresh_token;
    await c.auth.signOut();
    const r = await anonClient().auth.refreshSession({ refresh_token: refresh });
    expect(r.error).not.toBeNull();
  });
});
