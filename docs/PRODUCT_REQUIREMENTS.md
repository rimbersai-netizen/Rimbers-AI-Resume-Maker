# Product Requirements — Global AI Resume Studio (working name)

Name is provisional until branding/trademark checks.

## Goal
Users enter career data once (master profile) and generate country-appropriate, job-specific,
editable CVs/resumes, cover letters and LinkedIn copy — on web, Android, iOS — with an admin console.

## Personas
- **Job seeker (guest or registered)** — builds profile, generates/export CVs.
- **Premium user** — tailoring, unlimited exports, cover letters, DOCX.
- **Admin / support / content editor** — templates, country rules, users, billing, AI ops.

## Core workflow (15 steps)
Country → profession → personal info → experience → education → skills/certs/languages →
optional import → resume language → template (or auto-recommend) → AI content →
review AI claims → preview/customize → ATS analysis → export PDF/DOCX → save/duplicate/version.
Autosave + recovery throughout. Many resume versions per master profile.

## Non-negotiable product rules
1. AI never invents employers, titles, degrees, certs, skills, dates, achievements, or numbers.
   Every AI suggestion is traceable to source fields and requires user acceptance.
2. ATS analysis is a transparent heuristic. No "guaranteed ATS pass" claims.
3. Country rules are hiring *conventions* with sources and review dates; always user-overridable.
4. Sensitive fields (photo, DOB, nationality, marital status) are optional, never required.
5. Local AI first. Cloud fallback is disabled by default, and requires admin config + per-user consent.
6. PDF text selectable; DOCX genuinely editable (no image-only exports).
7. Entitlements enforced server-side only.
8. Machine translations are labeled unverified until reviewed.

## Scope (MVP → full)
| Area | Requirement |
|---|---|
| Countries | 30 initial (GCC, NA, EU, UK, ANZ, South/Southeast Asia, JP, KR) |
| Templates | ≥100 original layouts, 21 categories; color-only variants don't count |
| Languages | en, ar, ur, fr, de, es, it, pt, hi, tr, zh, ja (ar/ur RTL) |
| Import | PDF, DOCX, TXT; review before merge; never silent overwrite |
| Plans | FREE, STANDARD, PROFESSIONAL, PREMIUM; monthly/yearly/one-time |
| Payments | Moyasar (web), Apple IAP, Google Play Billing |

## Acceptance workflows
A–L as defined in the master prompt (see `checkpoints/MASTER_PROGRESS.md` for status).
