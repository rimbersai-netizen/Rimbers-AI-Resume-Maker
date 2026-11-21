# Next Action

Env: Node 26.13.1, pnpm 9.15.9 working. Web: `pnpm -C apps/web build && pnpm -C apps/web start` (127.0.0.1:3100; needs apps/web/.env.local from `supabase status`).
Local Supabase: `supabase start -x studio,realtime,edge-runtime,imgproxy,vector,logflare,supavisor,postgres-meta` (Mailpit on 55424).

1. (10A done.) 10B: DOCX in services/document-worker using `docx` npm lib from the SAME ResumeDocument: real Heading1/2 styles,
   paragraphs + numbering for bullets, A4/Letter page size + margins, RTL (w:bidi, rightToLeft runs) for ar/ur, fonts
   (Inter/Noto by locale), hyperlinks. Worker: format 'docx' path. Tests: unzip document.xml → headings/paragraph text present,
   w:bidi for Arabic, page size; open in LibreOffice not available — validate XML schema-ish + mammoth text extraction.
   Enable DOCX button (entitlement export_docx: Free blocked unless one-time entitlement).
2. 10C: visual regression snapshots (Playwright screenshot per template, pixel diff threshold), Unicode edge cases, export regression.
3. Then 7B (ai-worker) → 8A/8B → 12A/12B.
4. 7B: services/ai-worker polling ai_jobs (service role), qwen3:4b primary, llama3.2:3b fallback, factCheck gate, ai_usage rows.
5. 14A wiring: server-side entitlement checks (evaluate()) before AI jobs / exports.
Regression before each commit: `pnpm check`, `supabase test db`, `bash supabase/tests/storage/storage-rls.test.sh`, `SUPABASE_IT=1 pnpm vitest run tests/integration`.
