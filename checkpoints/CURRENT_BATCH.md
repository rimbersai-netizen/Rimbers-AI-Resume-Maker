# Current Batch: 12D/12E — Job discovery, applications, tailoring, community (IMPLEMENTED, awaiting E2E verification)

28/60 VERIFIED. (12B LinkedIn, 12D, 12E and the Flutter app are IMPLEMENTED, not verified.)

## 2026-11-24 — what was built (from the user's reference screenshots in `D:\flutter projects\Resume Maker\images`)
- `packages/ats-engine/src/job-match.ts`: skill detection, `scoreJob` (0–100 estimate: 65% skills, 20% role title, 15% years), `tailorPlan` (strengths/optimizations/gaps). 10 tests.
- `apps/web/src/lib/services/{jobs,community}.ts` + `lib/api-route.ts`; `/api/v1/jobs{,/prefs,/pipeline,/pipeline/:id,/tailor,/tailor/apply,/tailor/finish}`, `/api/v1/community/{posts,posts/:id,…/comments,…/like,comments/:id,report}`.
- Web: `/jobs` (Discover swipe, Saved, Applications, Preferences, Tailor), `/community`, `/community/:id`.
- Flutter: Jobs tab (Discover/Saved/Applications), preferences, tailor, Community tab, All-tools page; 5-tab shell.
- Migration `20261124000011_jobs_community.sql` (+ pgTAP 005, not run). **Applied to the cloud project.**
- Evidence: `pnpm check` 493 passed / 280 skipped; `next build` OK; `flutter test` 12/12; live feeds 315 listings parsed + scored. Not verified: any signed-in flow (see BLOCKERS B11).

## Earlier today
Flutter app first pass (auth, home, resumes, editor+preview, profile builder, ATS, AI writer, cover letters, LinkedIn, settings, plans). `kotlin.incremental=false` needed (project on D:, pub cache on C:). iOS binaries cannot be built on Windows.
