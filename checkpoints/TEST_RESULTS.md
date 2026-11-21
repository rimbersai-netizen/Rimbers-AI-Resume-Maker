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

## 2026-11-21 04:00–04:15 — Node available (Homebrew node 26.13.1, pnpm 9.15.9)
- `pnpm install && pnpm check`: typecheck 9 packages OK; **296/296 pass** (9 skipped: live/integration gated) → 1C VERIFIED.
  All earlier Bun-only results reproduced on Node.
- Regression: `supabase db reset && supabase test db` 54/54; `storage-rls.test.sh` 16/16 (now creates pre-confirmed users).
- 2B: `SUPABASE_IT=1 vitest run tests/integration` **7/7**; `apps/web` typecheck + `next build` OK (11 routes).
- 2B browser E2E (in-app browser, prod server): defects found + fixed:
  1. React 19 form reset cleared email after validation errors → echo email in form state.
  2. Redirects went to `localhost` instead of `127.0.0.1` (Next rewrites absolute same-origin redirects; host-bound cookies) →
     relative Location in route handlers; protection moved to pages (middleware refreshes session only).
  3. Deletion message promised a confirmation email that doesn't exist yet → reworded.
  After fixes: sign-up validation, verify link → signed-in dashboard, export (200, attachment, 26 keys, own data),
  deletion request + duplicate blocked + audit log rows, sign-out, wrong password generic error, sign-in, guest mode: all pass.
- Live Ollama (CPU idle): llama3.2:3b 21 s — **invented "4+ years"; factCheck blocked it**. qwen3:4b 32 s — faithful.
  Fixed 2 factCheck false positives (month names, trailing period). Re-run qwen3:4b: ok, no violations. Full suite 298/298.

## 2026-11-21 04:20–04:55 — Phase 3 (master profile)
- Migration 0003: master_profiles.extras, master_profile_versions (+RLS), get_master_profile / save_master_profile (SECURITY INVOKER,
  atomic, optimistic concurrency). pgTAP 002 first run 14/16 — my test's JSON expression was wrong (not the function); fixed → **70/70**.
- Unit (apps/web profile-draft): first run 25/28 — real bug: cleanEmpty stripped blank bullet text before the blank-bullet filter →
  validation failure. Fixed ordering → 28/28; +3 toDraft tests → 31/31.
- Browser E2E found + fixed: (1) crash on new profile (DB returns personal without location; raw object used) → toDraft normaliser;
  (2) focus-to-first-error ran before render; (3) empty email could pass "Continue" (schema-optional) → step-level check;
  (4) mobile: stepper clipped, button wrapped → small-screen CSS.
  Verified in UI: validation + focus, invalid link blocks save, autosave → DB rows correct (order, current role, bullets, type, dedupe
  skills, language), reload persistence, crash-recovery banner + restore, conflict (other-device bump) → keep mine, named version +
  restore, photo upload (signed URL; PDF rejected), 375 px no horizontal scroll.
- SUPABASE_IT: auth 7 + profile 4 = **11/11**. Full: `pnpm check` **314/314**; storage 16/16; web typecheck 0 errors.

## 2026-11-21 05:00–05:45 — 4C + 5C (new-resume flow, editor, live preview)
- Migrations 0004 (resume settings + save_resume_layout), 0005 (GENERATED catalog: 105 templates published + versions,
  30 country rules as draft + 49 sources; `pnpm gen:catalog`, sync test), 0006 (drop custom_needs_heading).
- pgTAP: 001 assertions updated for 105-template catalog; 003 resume layout 9 → **79/79**.
- Unit: resume-settings 14 (first run 13/14 — my expectation was wrong: DE accepts English so an English app keeps
  English; added Arabic-app case). template-engine +2 (bdi isolation, Arabic comma). Full **331/331**.
- Browser E2E found + fixed: (1) create failed: default 'custom' placeholder section violated custom_needs_heading →
  constraint dropped + createResume now compensates (deletes half-created row so quota isn't consumed);
  (2) bidi: English punctuation flipped inside Arabic resume → all user text wrapped in <bdi>; (3) Arabic-script
  separators use "،".
  Verified: SA preselected from profile; en app → en resume, Arabic offered; manual locale survives country switch;
  Arabic resume renders RTL with Arabic headings, "حتى الآن", MM/YYYY, A4, bdi-isolated email; app stays LTR;
  Free plan blocks 2nd resume with upgrade message (DB count stays 1). A real user changed locale/template/page in the
  editor during testing — autosave stored them with `overridden` = [locale, templateId, pageSize]; left as the user set them.
- Regression: storage 16/16; SUPABASE_IT 11/11; web typecheck + build OK.

## 2026-11-21 05:50–06:45 — 10A PDF export (+5B, 5C)
- Env: Playwright 1.49 Chromium download/extract **hung twice under Node 26** (zip extraction stalls after first file).
  Workaround: downloaded zip verified with `unzip -t`, extracted manually to ~/Library/Caches/ms-playwright/
  chromium_headless_shell-1148 + INSTALLATION_COMPLETE marker. `CHROMIUM_EXECUTABLE` env supported as fallback.
- PDF_IT (real Chromium) found 4 real defects, all fixed:
  1. "Software" extracted as "So\u0000ware": font ligatures (fi/ft) unmapped → ligatures off for non-Arabic-script docs.
  2. Inter contextual alternates (+ and – beside digits) unmapped → calt off for non-Arabic-script docs.
  3. System Arial (macOS) used for Arabic and system Devanagari before bundled Noto → output depended on host fonts →
     bundled script fonts now precede system fonts.
  4. Japanese rendered with SC glyph forms (Han unification) → locale-ordered script fonts (ja: JP first; ur: Nastaliq first).
  Test corrections (not product bugs): case-insensitive match for CAPS headings; Arabic/Urdu shaped glyphs are exported via
  /ActualText (pdf.js ignores it) → test reads ActualText; Nastaliq clusters → per-cluster ActualText.
  Final: **114/114** (105 templates + links + pagination + 5 scripts + consistency + network blocking).
- SUPABASE_IT + PDF_IT: export 3/3 (owner-only storage + signed URL, failed job recorded, clients can't claim). Total integration 14/14.
- UI E2E (background tab, worker running): export → "ready" → 44 KB application/pdf; Free plan 3rd export blocked (DB count 2).
- Preview fonts: Next bundling broke dynamic font resolution → fonts now copied to apps/web/public/fonts at prebuild
  (511 files, 13 MB, gitignored); iframe loads Inter + Noto Sans Arabic from the same files the PDF embeds.
- Regression: unit 333/333, pgTAP 79/79, storage 16/16, web typecheck OK. Disk 29 GB free.

## 2026-11-21 06:50–07:30 — 10B DOCX
- New: buildContentModel (format-neutral, localized) + services/document-worker/src/docx.ts (`docx` 9.0.2).
- DOCX tests: first run 100/110 failed parity — real inconsistency: DOCX dropped "https://" from credential links while PDF shows
  full URL → fixed → **110/110**.
- macOS textutil (independent parser) found: English DOCX lines prefixed with U+200F — library emits <w:bidi w:val="false"/>,
  which Apple's reader treats as RTL → RTL flags now emitted only for RTL docs; test asserts none in LTR docs. Re-check clean.
- SUPABASE_IT export 4/4 (incl. DOCX Arabic RTL). UI: Free → "DOCX included from Standard"; one-time entitlement → 8 KB .docx.
- Regression: unit 443/443 (incl. DOCX), PDF 114/114, pgTAP 79/79, storage 16/16, integration 15/15, web typecheck OK.
