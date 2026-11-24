# Existing Project Audit — Global AI Resume Studio

Audit date: 2026-11-24. Source of truth for batch status: `checkpoints/PHASE_STATUS.json` (28/60 VERIFIED before this session).
Everything below was checked against the repo on disk; items marked *(per checkpoints)* rely on recorded test evidence from the earlier macOS sessions and were not re-run here.

## 0. Environment change (important)
The repo was developed on macOS (Intel i7, Docker, Ollama, Homebrew Node). The current workspace is **Windows 11**:

| Tool | State on this machine |
|---|---|
| Node 26.13.1 | present |
| pnpm | was missing → installed 9.15.9; `node_modules` rebuilt for Windows (`pnpm install --frozen-lockfile`) |
| Docker / local Supabase | **not available** (no `docker`; Supabase CLI present) → pgTAP, storage RLS, `SUPABASE_IT` integration cannot run |
| Ollama | **not installed / port 11434 down** → live AI tests and AI worker cannot run |
| Chromium (Playwright) | not verified → `PDF_IT` PDF/visual/Unicode tests cannot run |
| Android SDK / Xcode | not verified (Xcode impossible on Windows; iOS builds need a Mac) |
| RAM | ~3.7 GB free at audit time (16 GB machine, other apps) |

`pnpm check` on this machine: typecheck OK, **476 tests pass, 280 skipped** (the skipped ones are the Docker/Chromium/Ollama-gated suites).

## 1. Architecture (existing)
pnpm monorepo: `apps/{web,admin,mobile}`, `packages/*` (`@gars/*`), `services/{ai-worker,document-worker}`, `supabase/`.
- **apps/web** — Next.js (App Router) + Supabase SSR auth. **Real, working.**
- **apps/admin** — *empty directory.*
- **apps/mobile** — *empty directory.* Design docs exist (`docs/design/MOBILE_*`, two reference PNGs); no code.
- **packages**: resume-schema (Zod contract), template-engine (105 layouts, semantic RTL-aware HTML), document-engine, fonts, country-rules (30 countries), ats-engine, ai-engine (provider abstraction, Ollama adapter, router/retries, fact checker, prompt tasks, job runner), localization, subscriptions (plans/quotas/evaluate), resume-builder, validation, analytics, ui, shared-types.
- **services**: document-worker (Chromium PDF, DOCX, queue, signed downloads), ai-worker (claims `ai_jobs` via service role, Ollama qwen3:4b → llama3.2:3b, fact-check gate, usage rows).
- **supabase**: 10 migrations (core schema, RLS+storage, profile I/O RPC, resume settings, template/country catalog, export queue, AI queue, cover letters, LinkedIn drafts), pgTAP 001–004.

## 2. Web routes that exist
`/` · `/sign-up` `/sign-in` `/forgot-password` `/reset-password` `/auth/*` · `/dashboard` · `/profile` (master profile builder) · `/resumes/new` (country/template wizard) · `/resumes/[id]` (editor + live preview + Job Match/ATS panel + AI assistant + export) · `/cover-letters` `/new` `/[id]` · `/linkedin` (new, uncommitted) · `/account` · `/api/account/export`.

**Not present as routes:** job search, saved jobs, application tracker, interview prep, AI agent chat, import/upload, subscription/billing page, email/resignation tools, notifications, settings for language, any admin pages.

## 3. Functionality status
**Working & verified (per checkpoints):** email auth, guest mode, data export, deletion request; master profile (autosave, conflict handling, versions, photo); country rules wired into resume creation; renderer + live preview sharing fonts with PDF; 105 templates (HTML/PDF/DOCX/visual baselines); PDF + editable DOCX export via worker; ATS analyzer + JD keyword matching + tailoring (summary override, original preserved); AI writing assistant (accept/edit/reject, provenance, fact-check gate); grammar/tone; cover letters (generate/edit/PDF/DOCX); server-side quotas/entitlements for AI + exports + resume limits (14A); RLS on all tables.

**Implemented, not verified:** 4B (30 country conventions need human review), 5A, 8C (history view).
**New this session:** 12B LinkedIn assistant — code complete (see §8), DB/live verification blocked by environment.
**In progress:** 7C (cloud provider adapter — needs paid-API authorization), 13A (localization: resolver/catalog exist, no UI language switcher/RTL app shell verified).
**Not started:** 11 Import (PDF/DOCX upload → review → merge), 12C Interview prep, job search/tracker, AI Resume Agent chat, resignation/professional emails, skills-gap/career recommendations, 14B/C payments + billing UI, 15 Admin, 16 Mobile, 17 hardening, 18 quality, 19 release.

## 4. AI integration
Provider abstraction + Ollama adapter + consent-gated cloud fallback (off by default) are real and unit-tested (scripted fake model). Live Ollama runs were recorded on the Mac (qwen3:4b faithful; llama3.2:3b hallucinated → fallback only). **No live AI possible on this machine until Ollama is installed**; UI shows safe "unavailable" errors when the worker/model is down (workflow I verified earlier).

## 5. Design references
`docs/design/reference/showcase-a-flows.png`, `showcase-b-screens.png` (mobile), `MOBILE_UI_REFERENCE.md`, `MOBILE_DESIGN_SYSTEM.md`. `assets/` has fonts, icons, templates. The working product name is provisional ("Global AI Resume Studio").

## 6. Testing status
Unit/package tests strong (476 runnable). Integration/pgTAP/PDF suites exist and passed on macOS (pgTAP 85/85, storage 16/16, integration 21/21 + live, worker 366/366) but are **not re-runnable here**. No component/E2E browser tests are committed (E2E was manual). No mobile/admin tests (no code).

## 7. Blockers
See `checkpoints/BLOCKERS.md` (updated): new B10 (Windows machine lacks Docker/Ollama/Chromium), plus B3–B9 carried over.

## 8. Uncommitted work found at start
12B LinkedIn assistant: `apps/web/src/app/linkedin/*`, migration `…0010_linkedin_drafts.sql` (length-checked `master_profiles.linkedin`, kept out of `save_master_profile`), ai-engine tasks (`linkedin_headline` ≤220, `linkedin_about` ≤2600, fact-checked), 3 unit tests (pass), integration tests (skipped here). The `ai_jobs.kind` constraint already allowed these kinds.

## 9. Recommended development order
1. Restore verification capability: install Docker Desktop (or run on the Mac), Ollama + qwen3:4b, Playwright Chromium → re-run full regression; verify 12B.
2. 11 Import (PDF/DOCX/TXT → review → merge) — the biggest builder gap vs. the brief.
3. 12C Interview prep + 8C history.
4. Job tracker (saved jobs, statuses, reminders, stats) — pure DB + UI, no external API needed; job *search* only via authorized API (see API_REQUIREMENTS.md).
5. AI Resume Agent (structured proposals, never silent edits), email/resignation tools, skills-gap.
6. 13 Localization UI (switcher, RTL shell) → 14B/C sandbox payments → 15 Admin → 16 Mobile (Expo; needs Android SDK, Mac for iOS) → 17–19.
