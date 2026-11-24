# Current Batch: 12B — LinkedIn assistant (IMPLEMENTED, awaiting verification)

Code complete + unit tests pass (2026-11-24, Windows). To VERIFY: run migration 0010 (`supabase db reset`), `SUPABASE_IT=1 pnpm vitest run tests/integration/ai.test.ts`, live `OLLAMA_LIVE=1`, browser E2E of /linkedin. Needs Docker + Ollama (B10).
28/60 VERIFIED. Audit docs written: docs/EXISTING_PROJECT_AUDIT.md, REZI_FEATURE_RESEARCH.md, FEATURE_COMPARISON.md, API_REQUIREMENTS.md.

## 2026-11-24 — Mobile started (Flutter, per user decision; replaces the Expo plan)
apps/mobile = Flutter app (Riverpod, go_router, supabase_flutter). Talks to web backend `/api/v1/*` (bearer JWT) so plan limits + Zod validation stay server-side.
Done: flutter analyze 0 errors/warnings; `flutter test` 8/8; `flutter build apk --debug` OK (needs kotlin.incremental=false because project is on D: and pub cache on C:).
NOT verified: any screen against a live backend. User's cloud Supabase (kexkcfqcfwclmtmzprif) has NO tables yet; pushing migrations needs user approval + DB password; workers need service_role key (user-provided, .env.local only). anon key stored in apps/mobile/.env.cloud (git-ignored).
iOS: code is shared; iOS binaries cannot be built on Windows.
