# Next Action

Env: Node 26.13.1, pnpm 9.15.9 working. Web: `pnpm -C apps/web build && pnpm -C apps/web start` (127.0.0.1:3100; needs apps/web/.env.local from `supabase status`).
Local Supabase: `supabase start -x studio,realtime,edge-runtime,imgproxy,vector,logflare,supavisor,postgres-meta` (Mailpit on 55424).

1. (Phases 5, 6, 10 done.) Next 7B → 8A/8B/8C → 9 UI → 12.
2. (7B, 8A done.) 8B: grammar/tone tasks + job-specific tailoring (JD → keyword-aware rewrite, never adding skills
   the user lacks; reuse ats-engine extractKeywords; missing required skills surfaced as questions, not inserted).
   8C remainder: suggestion history (ai_jobs list per profile). Then 9 UI (ATS analysis page + JD matching, reference A-5/B-9),
   12A/12B (cover letter, LinkedIn), 11 (import).
4. 7B: services/ai-worker polling ai_jobs (service role), qwen3:4b primary, llama3.2:3b fallback, factCheck gate, ai_usage rows.
5. 14A wiring: server-side entitlement checks (evaluate()) before AI jobs / exports.
Regression before each commit: `pnpm check`, `supabase test db`, `bash supabase/tests/storage/storage-rls.test.sh`, `SUPABASE_IT=1 pnpm vitest run tests/integration`.
