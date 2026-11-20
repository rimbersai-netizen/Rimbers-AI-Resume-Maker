# CLAUDE.md — Global AI Resume Studio

## Identity
Global AI-powered CV/resume platform: web (Next.js), mobile (Expo RN), admin (Next.js), Supabase backend,
local-first AI via Ollama. Working name is provisional. Full spec: 20 phases / 60 batches (see `checkpoints/PHASE_STATUS.json`).
Docs: `docs/PRODUCT_REQUIREMENTS.md`, `docs/ARCHITECTURE.md`, `docs/ACCEPTANCE_CRITERIA.md`.

## Repo
- This folder is its OWN git repo. `/Users/mak` (home) is also a git repo — never commit there.
- pnpm workspace: `apps/*`, `packages/*` (`@gars/<name>`), `services/*`. Packages export TS source (`main: src/index.ts`).
- Data contract: `packages/resume-schema` (Zod). All layers validate through it.

## Commands
- `pnpm install` · `pnpm test` (vitest) · `pnpm typecheck` (tsc -b) · `pnpm check` (both)

## Rules
- AI must never invent facts (employers, dates, degrees, skills, numbers). Suggestions carry provenance and need user acceptance.
- No AI calls from clients; only `services/ai-worker` talks to Ollama on 127.0.0.1. Cloud fallback off unless configured + consented.
- No "guaranteed ATS" claims. Country rules = conventions with sources + reviewDate; user-overridable.
- Sensitive fields (photo, DOB, nationality) always optional.
- Entitlements server-side only. Webhooks verified + idempotent.
- Machine: Intel i7, 16 GB RAM, ~26 GB free disk. One LLM at a time; no parallel heavy builds.

## Testing
- Each batch: targeted tests; phase boundaries: full `pnpm check`. Record real output in `checkpoints/TEST_RESULTS.md`.
- Mark VERIFIED only when acceptance criteria actually pass. Never fabricate evidence.

## Resume procedure (new session)
1. Read this file, `checkpoints/CURRENT_BATCH.md`, `checkpoints/NEXT_ACTION.md`, `checkpoints/BLOCKERS.md`.
2. `git status` here. 3. Re-run `pnpm check`. 4. Continue first incomplete task. Don't redo VERIFIED batches.

## Protected / requires explicit user approval
Paid services, external account auth (Supabase cloud project, Moyasar, Apple/Google consoles), production DB changes,
production deploys, payment activation, app-store publishing, sending user data to external AI, destructive changes.
