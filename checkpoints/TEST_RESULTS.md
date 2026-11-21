# Test Results

## 2026-11-21 — Batch 1A
- Environment audit run; results in ENVIRONMENT.md.

## 2026-11-21 — Batch 1B/1C (interim, run under Bun 1.x because Node was broken)
- First run: 35 passed, 1 failed — `isPlausiblePhone("(555) 123-4567")` rejected leading "(". Fixed regex.
- Second run: `vitest run` → 2 files, **36/36 passed**.
- `tsc -b packages/shared-types packages/resume-schema packages/validation` → **OK, 0 errors**.
- PENDING for 1C VERIFIED: same checks via `pnpm install && pnpm check` on Homebrew Node (Blocker B1).

## 2026-11-21 — Batch 2A (+2C table RLS)
- `supabase start` (local, ports 554xx): both migrations applied, seed loaded.
- `supabase test db` run 1: 41/41 assertions passed but plan mismatch (46 run) and the audit-log delete test
  passed vacuously against an empty table → test was wrong. Fixed the test to insert first; added TRUNCATE guard trigger.
- `supabase db reset && supabase test db` run 2: **54/54 PASS**. Covers: 34 tables exist, RLS on all tables,
  profile auto-create, date constraint, cross-user select/insert/update/delete denial, composite-FK cross-attach
  denial, AI job enqueue-only, append-only audit log (update/delete/truncate), anon catalog-only access.

## 2026-11-21 — Batch 2C storage
- `bash supabase/tests/storage/storage-rls.test.sh` → **16/16 PASS**: own-folder upload/read/delete; cross-user
  upload/read/sign/delete denied; client writes to resume-exports denied; MIME allowlist; 10 MB limit; public URL
  disabled; owner signed URL downloads; REST cross-user profile read returns []. Test users cleaned up.
- Node build check 03:10: progressing (~20 objects/min, 906/1803), allowed to continue per instruction.

## 2026-11-21 — Batch 4A/4B (under Bun, Node still compiling)
- `vitest run` → 3 files, **86/86 pass** (country-rules 50). `tsc -b` 4 packages → OK.
- Country data honesty: all 30 entries `unreviewed`; sources are review entry points (gov/EU/editorial), not per-value proof.

## 2026-11-21 — 13A (partial, under Bun)
- `vitest run` → 4 files, **112/112 pass** (localization 26: en/ar/ur/de device, unsupported→en, SA/PK no forcing,
  manual persistence, country change, guest merge, fallback, coverage honesty). `tsc -b` 5 packages OK.
