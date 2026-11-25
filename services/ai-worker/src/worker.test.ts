import { describe, expect, it } from "vitest";
import { processAiJob, type AiJobRow } from "./worker";

/** Minimal supabase stand-in: records ai_jobs updates, serves subscriptions rows. */
function fakeDb(subs: unknown[]) {
  const updates: Record<string, unknown>[] = [];
  const db = {
    from: (table: string) => ({
      select: () => ({ eq: () => Object.assign(Promise.resolve({ data: table === "subscriptions" ? subs : [] }), { maybeSingle: async () => ({ data: null }) }) }),
      update: (fields: Record<string, unknown>) => ({ eq: async () => { updates.push(fields); return {}; } }),
      insert: async () => ({}),
    }),
    rpc: async () => ({ data: null }),
  };
  return { db: db as never, updates };
}

const job = (kind: string, input: object): AiJobRow => ({ id: "j1", user_id: "u1", kind, input, attempts: 1, max_attempts: 3, cloud_consent: false });
const deps = { provider: { name: "x", isLocal: true, health: async () => ({ ok: false }), generate: async () => { throw new Error("must not be called"); } } as never, route: { localModels: ["m"], maxAttempts: 1, backoffMs: 0 } as never };
const prep = { masterProfileId: "00000000-0000-4000-8000-000000000001", locale: "en", jobTitle: "Flutter Developer", count: 8 };

describe("interview_prep plan gate in the worker", () => {
  it("fails with plan_required for a user without a Professional subscription (direct inserts cannot bypass the API)", async () => {
    const { db, updates } = fakeDb([]);
    const r = await processAiJob(db, job("interview_prep", prep), deps);
    expect(r).toEqual({ ok: false, code: "plan_required" });
    expect(updates[0]).toMatchObject({ status: "failed", error_code: "plan_required" });
  });

  it("also blocks Standard", async () => {
    const { db } = fakeDb([{ plan_id: "STANDARD", status: "active", current_period_end: new Date(Date.now() + 86_400_000).toISOString(), cancel_at_period_end: false }]);
    expect((await processAiJob(db, job("interview_prep", prep), deps)).code).toBe("plan_required");
  });

  it("lets a Professional subscriber through to the normal flow (here: profile not found)", async () => {
    const { db, updates } = fakeDb([{ plan_id: "PROFESSIONAL", status: "active", current_period_end: new Date(Date.now() + 86_400_000).toISOString(), cancel_at_period_end: false }]);
    const r = await processAiJob(db, job("interview_prep", prep), deps);
    expect(r.code).toBe("not_found");
    expect(updates[0]).toMatchObject({ error_code: "not_found" });
  });
});
