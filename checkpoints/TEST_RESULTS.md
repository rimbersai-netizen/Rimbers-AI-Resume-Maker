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

## 2026-11-21 — 9A–9C engine (under Bun)
- ats-engine first run 13/14: test wrongly matched "will pass" inside the disclaimer text itself; fixed the test scope.
- Full suite: 5 files, **126/126 pass**; `tsc -b packages/ats-engine` OK.

## 2026-11-21 — 7A/7B/8C engine (under Bun)
- ai-engine first run: factCheck "Google" entity test failed — real bug: multi-word skill list split on spaces
  ("google cloud" → "google"). Fixed (comma-delimited). Re-run: full suite **144/144 pass**, 2 live tests skipped.
- Live Ollama (OLLAMA_LIVE=1): health **PASS**; generation with qwen3:4b **TIMED OUT at 240 s** — CPU saturated by
  the Node source build (load avg 26–51). Timeout path behaved correctly. Re-run after build. NOT a model verification.

## 2026-11-21 — 5A/5B/6A–6C template engine (under Bun)
- Removed `split_header` column mode before counting (rendered identically to `single` → would inflate layout count).
- tsc caught duplicate `label` key in library rules; fixed.
- Full suite: 8 files, **267/267 pass** (+2 live skipped). template-engine 123: 105 templates, unique layoutKeys,
  21 categories, AA contrast ≥4.5, every template renders (no tables, XSS escaped, hidden items excluded),
  RTL/Arabic headings + bdi isolation, Urdu line-height, DE/JP date formats, photo rules, javascript: links blocked.
- Typecheck: all 8 packages OK.
