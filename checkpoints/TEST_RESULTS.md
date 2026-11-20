# Test Results

## 2026-11-21 — Batch 1A
- Environment audit run; results in ENVIRONMENT.md.

## 2026-11-21 — Batch 1B/1C (interim, run under Bun 1.x because Node was broken)
- First run: 35 passed, 1 failed — `isPlausiblePhone("(555) 123-4567")` rejected leading "(". Fixed regex.
- Second run: `vitest run` → 2 files, **36/36 passed**.
- `tsc -b packages/shared-types packages/resume-schema packages/validation` → **OK, 0 errors**.
- PENDING for 1C VERIFIED: same checks via `pnpm install && pnpm check` on Homebrew Node (Blocker B1).
