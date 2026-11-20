# Acceptance Criteria (per phase, summary)

A batch is VERIFIED only when its listed checks run and pass; evidence goes to `checkpoints/TEST_RESULTS.md`.

| Phase | Verified when |
|---|---|
| 1 Foundation | `pnpm install`, `pnpm typecheck`, `pnpm test` pass on a clean checkout; docs + checkpoints exist |
| 2 Supabase/Auth | Migrations apply on local Supabase; RLS tests prove cross-user denial (workflow H) |
| 3 Master profile | Forms validate with shared schema; autosave round-trips; unit + component tests |
| 4 Country rules | 30 configs pass schema validation, each has ≥1 source and reviewDate |
| 5 Document engine | Schema fixtures render; pagination tests show no clipped/blank pages |
| 6 Templates | ≥100 distinct layout specs; each renders HTML+PDF+DOCX in automated test; visual snapshots |
| 7 Local AI | Ollama adapter health check + timeout/retry tests; Ollama-down returns safe error (workflow I) |
| 8 AI writing | Fact checker rejects invented numbers/orgs in tests; suggestions require acceptance |
| 9 ATS | Deterministic scores on fixtures; explanations present; no guarantee wording |
| 10 Export | PDF text extractable; DOCX opens and paragraphs editable (workflow A, E) |
| 11 Import | PDF/DOCX/TXT fixtures extract into review UI; no silent overwrite (workflow C) |
| 12 Career tools | Cover letter / LinkedIn / interview outputs validated and fact-checked |
| 13 Localization | 12 catalogs; RTL PDF for ar renders correct glyph order (workflow B) |
| 14 Subscriptions | Test-mode payment → webhook → entitlement; cancel revokes (F, G) |
| 15 Admin | RBAC tests; template publish visible to users (K) |
| 16 Mobile | Expo app builds for Android + iOS simulator; core flow works |
| 17 Security | Threat model; deletion + export flows (J) |
| 18–20 | Full regression, accessibility, device tests (L), release candidates, handover |
