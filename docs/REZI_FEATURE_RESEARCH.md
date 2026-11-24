# Rezi Feature Research

Researched 2026-11-24 from public pages (search-result summaries of rezi.ai marketing/docs pages and third-party reviews; rezi.ai pages were not fetched in full, so treat details as indicative and re-verify before relying on them). Rezi is a **functional reference only** — no branding, assets, copy, or UI are copied.

Sources: [pricing](https://rezi.ai/pricing) · [Rezi Score docs](https://www.rezi.ai/rezi-docs/the-rezi-score-explained) · [keyword targeting docs](https://www.rezi.ai/rezi-docs/ai-keyword-targeting-explained) · [target a job description](https://www.rezi.ai/rezi-docs/how-to-target-a-job-description) · [AI job search](https://www.rezi.ai/ai-job-search) · [Resume Genius review](https://resumegenius.com/reviews/rezi-ai-review) · [Kickresume comparison](https://www.kickresume.com/en/help-center/alternative-to-rezi/) · [Rezi AI info](https://www.rezi.ai/ai-llm-info)

Findings that could not be confirmed: a native **mobile app** (sources describe Rezi as web-based) and a standalone **job tracker** (one marketing page shows a job board with Applied/Interviewing/Rejected states; a comparison page says tracking is not tightly integrated). Pricing reported inconsistently (Pro ≈ $29/mo, lifetime ≈ $129–149, free tier exists).

## Feature table
Legend — Ours: ✅ exists & verified · 🟡 partial/unverified · ❌ missing.

| # | Rezi feature | What it does / UX | Frontend | Backend | AI | DB | Ours | To build |
|---|---|---|---|---|---|---|---|---|
| 1 | AI resume builder/editor | Section editor with live preview, AI bullets/summary | editor, preview | autosave, limits | write/rewrite | resumes, documents | ✅ (drag-drop reorder of sections: verify) | confirm section reorder UX, custom sections |
| 2 | Rezi Score (100-pt) | Real-time score, category breakdown, tailored to level/field | score panel | analyzer | none required | ats_results | ✅ ATS panel w/ categories | experience-level weighting; click-to-section nav |
| 3 | ATS resume checker | Flags columns/headers/footers/label problems | checker UI | rules | – | ats_results | 🟡 heuristics exist | formatting/parse-risk checks surfaced per template |
| 4 | Keyword targeting | Paste JD → missing keywords, where to add | JD panel | extractor | optional | job_descriptions | ✅ | placement suggestions per role |
| 5 | AI bullet/summary writing | Generate/improve text | inline assist | job queue | LLM | ai_jobs, ai_usage | ✅ (fact-checked) | "shorter / more impactful / keywords" quick actions: verify coverage |
| 6 | AI Resume Agent | Chat that edits/optimizes resume | chat UI | conversation store | tool-use LLM | ai_conversations | ❌ | full feature (Phase proposal-diff UX) |
| 7 | AI cover letter | From resume + JD | builder, export | job + export | LLM | cover_letters | ✅ | alternatives/paragraph rewrite: verify |
| 8 | AI interview practice | Job/resume-tailored questions | session UI | sessions | LLM | interview_sessions | ❌ | 12C |
| 9 | AI job search / board | Search + status board | search, board | job-source adapter | match | saved_jobs, applications | ❌ | tracker first; search needs authorized API |
| 10 | Templates | ATS-oriented template set | gallery | renderer | – | resume_templates | ✅ 105 (exceeds) | – |
| 11 | PDF/DOCX download | Export | export UI | worker | – | document_exports | ✅ | – |
| 12 | Import existing resume | Upload → parse | upload, review | parser | optional | import_jobs | ❌ | Phase 11 |
| 13 | Plans/billing | Free/Pro/Lifetime | pricing, account | webhooks, entitlements | – | subscriptions | 🟡 entitlements only | 14B/C sandbox payments + UI |
| 14 | LinkedIn tools | (Rezi markets LinkedIn optimization) | tabs | job kinds | LLM | master_profiles.linkedin | 🟡 12B implemented | verify |
| 15 | Mobile app | none confirmed | – | – | – | – | ❌ | Expo app (our differentiator) |

## Our differentiators beyond Rezi
Country-specific CV rules (30 countries) independent of app language; RTL/Arabic/Urdu export; 105 templates; local-first private AI with a fact-check gate; editable DOCX parity; per-job tailored versions that preserve the master.
