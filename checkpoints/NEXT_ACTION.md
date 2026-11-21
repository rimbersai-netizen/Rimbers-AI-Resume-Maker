# Next Action

Env: Node 26.13.1, pnpm 9.15.9 working. Web: `pnpm -C apps/web build && pnpm -C apps/web start` (127.0.0.1:3100; needs apps/web/.env.local from `supabase status`).
Local Supabase: `supabase start -x studio,realtime,edge-runtime,imgproxy,vector,logflare,supavisor,postgres-meta` (Mailpit on 55424).

1. (10A, 10B done.) 10C: visual regression — Playwright screenshot of page 1 for each of 105 templates (en) + ar/ur/ja samples,
   stored as baselines in tests/visual/__snapshots__ (PNG, small viewport scale), pixel-diff threshold; Unicode edge cases
   (emoji, combining marks, very long words/URLs, mixed bidi); export regression (PDF+DOCX for edge-case profiles). Then mark 6A–6C.
2. Then 7B (ai-worker) → 8A/8B → 12A/12B.
4. 7B: services/ai-worker polling ai_jobs (service role), qwen3:4b primary, llama3.2:3b fallback, factCheck gate, ai_usage rows.
5. 14A wiring: server-side entitlement checks (evaluate()) before AI jobs / exports.
Regression before each commit: `pnpm check`, `supabase test db`, `bash supabase/tests/storage/storage-rls.test.sh`, `SUPABASE_IT=1 pnpm vitest run tests/integration`.
