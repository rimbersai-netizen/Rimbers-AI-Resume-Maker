# Next Action

Env: Node 26.13.1, pnpm 9.15.9 working. Web: `pnpm -C apps/web build && pnpm -C apps/web start` (127.0.0.1:3100; needs apps/web/.env.local from `supabase status`).
Local Supabase: `supabase start -x studio,realtime,edge-runtime,imgproxy,vector,logflare,supavisor,postgres-meta` (Mailpit on 55424).

1. (3A–3C done: /profile builder.) 4C: "New resume" flow — country picker (flags, search) + resume language (independent of
   app language) → recommendResumeSettings → create resume_documents row (section order, page size, photo default, template
   recommendation) with user overrides. 5C: live preview pane using renderResumeHtml from the master profile + resume settings.
3. 10A: Playwright Chromium PDF from renderResumeHtml + pdf text extraction test for all 105 templates. 10B: DOCX (`docx` lib).
4. 7B: services/ai-worker polling ai_jobs (service role), qwen3:4b primary, llama3.2:3b fallback, factCheck gate, ai_usage rows.
5. 14A wiring: server-side entitlement checks (evaluate()) before AI jobs / exports.
Regression before each commit: `pnpm check`, `supabase test db`, `bash supabase/tests/storage/storage-rls.test.sh`, `SUPABASE_IT=1 pnpm vitest run tests/integration`.
