# Development Roadmap (updated 2026-11-24)

Status words: **VERIFIED** = acceptance criteria passed with recorded evidence. **IMPLEMENTED** = code + unit tests, not verified end to end. See `checkpoints/PHASE_STATUS.json` for per-batch status.

## Done
- Phases 1–10 (foundation → export), 12A cover letters, 14A AI quota: VERIFIED earlier (macOS, local Supabase).
- Windows dev environment: pnpm, Chrome-based PDF/DOCX/Unicode tests, per-OS visual baselines (112), live Ollama.
- Backend `/api/v1` for mobile; shared services keep limits server-side.
- Flutter app first pass; cloud Supabase schema applied (11 migrations).
- **12D Job discovery** (preferences, swipe feed with match scores, saved, application tracker, job tailoring) and **12E Community**: IMPLEMENTED on backend, web and Flutter. Unit/UI-model tests pass; live feeds verified (315 listings parsed, scored); E2E with a signed-in user not yet run.

## Next, in order
1. **Verify on the cloud project** (needs a test account the user signs up, or approval to create one): web `/jobs`, `/community`, mobile on the `tab7` emulator; run workers (ai-worker needs `service_role` key in git-ignored `.env.local`).
2. Run pgTAP + storage RLS + `SUPABASE_IT` once Docker/WSL2 is installed (B10), or against a throwaway Supabase branch.
3. 12B LinkedIn: verify. 12C interview prep. Phase 11 resume import (PDF/DOCX/TXT → review → merge).
4. Phase 13 localization UI (app language switch, RTL pass on mobile). 
5. Phase 14B/C billing in **sandbox only** (Moyasar test mode) after approval; mobile plans screen then enables purchase.
6. Phase 15 admin dashboard (`apps/admin`): users, templates, countries, community moderation queue (reports), AI ops, audit.
7. Phase 17 security hardening (remove client INSERT policies on queue tables, rate limits on `/api/v1`, dependency audit), Phase 18 quality (a11y, Playwright, device matrix), Phase 19 deployment readiness (no deploy without approval).
8. Android release build (signing keys = user); iOS build only via a Mac or paid cloud build (approval).

## Protected (always ask first)
Paid services, production deploys, payment activation, store publishing, sending user data to external AI, destructive DB changes.
