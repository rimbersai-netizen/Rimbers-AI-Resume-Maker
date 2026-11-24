# AI Architecture (updated 2026-11-24)

## Principles (from CLAUDE.md, enforced in code)
1. AI never invents facts. Output passes a deterministic fact-check gate (`ai-engine`): new numbers, dates, employers, degrees or skills not present in the profile are blocked (`unverified_facts`) or flagged for the user to confirm.
2. No AI calls from clients. Only `services/ai-worker` talks to Ollama (127.0.0.1:11434). Cloud fallback is off unless configured and consented.
3. Suggestions carry provenance (`sourceFieldIds`) and need explicit acceptance.

## Pipeline
`ai_jobs` queue (RLS owner insert after server-side quota) → `claim_ai_job()` (service role, `skip locked`, lock expiry) → build task from the saved master profile → Ollama (`qwen3:4b`, fallback `llama3.2:3b`; structured JSON) → Zod output validation → fact-check → store output / error code → client polls `GET /api/v1/ai-jobs/:id`.

Job kinds: `summary`, `achievement_bullets`, `grammar`, `tone`, `tailor_resume`, `cover_letter`, `linkedin_headline`, `linkedin_about`.

## What is deliberately *not* AI
- **ATS score, keyword matching, job match score, strengths/optimizations/gaps** – deterministic code (`@gars/ats-engine`): explainable, repeatable, testable. Match scores are labelled estimates.
- Cover-letter signature, skill ordering, dates, salary parsing.

## Job tailoring (new)
Plan computed deterministically from the user's profile. Only skills the user ticks are added to the profile (server re-checks each against its own plan; audit-logged as `user_confirmed`). The role-focused summary is the existing `tailor_resume` AI job (matched/missing from the ATS engine; skill-like terms the user lacks are forbidden), stored as `summaryOverride` on the new resume only – the master profile is untouched.

## Verified so far (see TESTING_REPORT.md)
Live Ollama 2/2 on Windows (qwen3:4b faithful summary ≈ 35 s). Tailoring/cover-letter/LinkedIn live runs were verified earlier on macOS or are unverified (12B). CPU-only inference is slow: everything is asynchronous with progress and cancel.
