# Next Action

Env: Node 26.13.1, pnpm 9.15.9 working. Web: `pnpm -C apps/web build && pnpm -C apps/web start` (127.0.0.1:3100; needs apps/web/.env.local from `supabase status`).
Local Supabase: `supabase start -x studio,realtime,edge-runtime,imgproxy,vector,logflare,supavisor,postgres-meta` (Mailpit on 55424).

1. (Phases 5, 6, 10 done.) Next 7B → 8A/8B/8C → 9 UI → 12.
2. (12A done.) Next 12B LinkedIn assistant (reference A-10): tabs Profile/Headline/About/Skills; AI headline (≤220 chars) +
   About (≤2,600 chars) from profile facts, skills ordering deterministic; copy buttons; "Open LinkedIn" link (no API/login).
   Then 12C interview prep, 8C history view, 11 import (PDF/DOCX/TXT → review → merge, no silent overwrite).
4. 7B: services/ai-worker polling ai_jobs (service role), qwen3:4b primary, llama3.2:3b fallback, factCheck gate, ai_usage rows.
5. 14A wiring: server-side entitlement checks (evaluate()) before AI jobs / exports.
Regression before each commit: `pnpm check`, `supabase test db`, `bash supabase/tests/storage/storage-rls.test.sh`, `SUPABASE_IT=1 pnpm vitest run tests/integration`.
