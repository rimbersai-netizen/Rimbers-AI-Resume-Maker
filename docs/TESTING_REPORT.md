# Testing Report (2026-11-24, Windows 11, Node 26.13.1, Flutter stable)

Only results actually produced are listed. Detailed logs: `checkpoints/TEST_RESULTS.md`.

| Suite | Command | Result |
|---|---|---|
| Unit (all packages + web services) | `pnpm check` | **493 passed, 280 skipped** (skips need Chromium / Supabase / Ollama env); `tsc -b` exit 0 |
| Job matching engine | `vitest packages/ats-engine` | 26 passed (10 new: skill aliases, "go"≠Go, years, scoring, tailor plan) |
| Jobs/community services | `vitest apps/web/src/lib/services` | 7 passed (HTML cleaning, salary parse, preference filters, content guard) |
| Live public job feeds | `JOBS_LIVE=1 vitest …/jobs.live.test.ts` | 1 passed: 315 real listings (Remotive + Arbeitnow), scored |
| Web production build | `next build` | compiled; all new pages and 14 new API routes present |
| PDF/DOCX/Unicode/visual (real Chrome) | `PDF_IT=1 pnpm vitest run services/document-worker` | 255 passed + visual 112/112 (run earlier today, before this batch; unaffected) |
| Live Ollama | `OLLAMA_LIVE=1` | 2/2 (earlier today) |
| Flutter static analysis | `flutter analyze` | 0 errors, 0 warnings, 81 infos (SDK deprecations) |
| Flutter tests | `flutter test` | **12/12** |
| Android build | `flutter build apk --debug` | built OK (`app-debug.apk`, includes the Jobs + Community screens) |
| Cloud DB | `supabase db push --remote` | 11 migrations applied; anonymous RLS probe OK |

## Defects found by testing (and fixed)
1. "go" in ordinary English matched the Go language → ambiguous skill words need exact casing.
2. Match scores were unrealistically low for a matching profile (generic words weighted like tools; TypeScript did not imply JavaScript) → implied skills + generic down-weighting.
3. Match bar overflowed on narrow/large-text layouts (Flutter test) → flexible label.
4. Next.js route type check rejected an optional context argument → required.

## Not tested (no evidence exists – do not treat as passing)
- pgTAP (incl. new `005_jobs_community.test.sql`), storage RLS, `SUPABASE_IT` integration: Docker is unavailable (B10).
- Any signed-in flow on web or mobile against the cloud project (B11): jobs swipe/save/apply, tailoring (needs workers + `service_role` key), community posting.
- Emulator/device UI, accessibility audit with a screen reader, RTL visual pass of the new screens, iOS.
- Load/abuse testing of `/api/v1` (rate limiting is DB-side for community only).
