# Next Action

Env: Node 26.13.1, pnpm 9.15.9 working. Web: `pnpm -C apps/web build && pnpm -C apps/web start` (127.0.0.1:3100; needs apps/web/.env.local from `supabase status`).
Local Supabase: `supabase start -x studio,realtime,edge-runtime,imgproxy,vector,logflare,supavisor,postgres-meta` (Mailpit on 55424).

1. (3A–3C, 4C done; 5C implemented.) Next 10A: services/document-worker — Playwright Chromium renders renderResumeHtml →
   PDF (fonts: bundle Noto Sans Arabic/Nastaliq Urdu/Devanagari/SC/JP in assets/fonts, @font-face, embed); export route
   enqueues document_exports, worker uploads to resume-exports/<uid>/..., signed URL download; entitlement export_pdf.
   Tests: pdf text extraction (pdfjs) for all 105 templates (en) + ar/ur samples, page count/no blank pages, links; preview↔PDF
   text consistency (closes 5C). Disk: Playwright chromium ~150 MB — OK (35 GB free).
3. 10B: DOCX (`docx` lib) from the same ResumeDocument (real headings, w:bidi for RTL).
4. 7B: services/ai-worker polling ai_jobs (service role), qwen3:4b primary, llama3.2:3b fallback, factCheck gate, ai_usage rows.
5. 14A wiring: server-side entitlement checks (evaluate()) before AI jobs / exports.
Regression before each commit: `pnpm check`, `supabase test db`, `bash supabase/tests/storage/storage-rls.test.sh`, `SUPABASE_IT=1 pnpm vitest run tests/integration`.
