# Next Action

Env (Windows): Node 26.13.1, pnpm 9.15.9. Chromium tests: set CHROMIUM_EXECUTABLE to the Chrome exe and PDF_IT=1. Ollama: per-user install (`ollama serve`).
Web backend against the cloud project: from `apps/web` run with `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` taken from `apps/mobile/.env.cloud` (git-ignored); mobile: `--dart-define=SUPABASE_URL=… --dart-define=SUPABASE_ANON_KEY=… --dart-define=API_BASE_URL=http://10.0.2.2:3100`.

## State (2026-11-24)
- Cloud Supabase `kexkcfqcfwclmtmzprif`: all 11 migrations applied (user asked to "upload supabase"). Tables exist, RLS blocks anonymous reads (checked).
- 12D Job discovery + 12E Community: IMPLEMENTED on backend, web and Flutter. NOT verified end to end.

## Do next
1. **E2E verification** (needs a signed-in account in the cloud project – the user should sign up once in the web app or approve creating a test user): `/jobs` (preferences → swipe → saved → applications), tailor flow (needs ai-worker + Ollama + `service_role` key in git-ignored `.env.local`), `/community`. Then the same on the Android emulator. Record real output in `TEST_RESULTS.md`, then mark 12D/12E VERIFIED.
2. Install Docker/WSL2 (B10) → run `supabase test db` (pgTAP 005 is written, never run), storage RLS, `SUPABASE_IT`.
3. 12B LinkedIn verify, 12C interview prep, Phase 11 import, Phase 13 localization UI, Phase 15 admin (incl. community moderation), 14B/C sandbox billing (approval), Phase 17 hardening.
Regression before each commit: `pnpm check`, `flutter analyze` + `flutter test` in apps/mobile.
