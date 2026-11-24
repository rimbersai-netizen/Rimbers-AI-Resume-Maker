# Database Architecture (updated 2026-11-24)

Supabase Postgres. 11 migrations in `supabase/migrations`, applied to the user's cloud project `kexkcfqcfwclmtmzprif` on 2026-11-24 (CLI `db push`, dry-run reviewed first). pgTAP tests in `supabase/tests/database` (5 files) – **not yet run** against any database in this environment (Docker unavailable, B10).

## Tables (public)
| Area | Tables |
|---|---|
| Identity | `profiles`, `admin_roles` |
| Master profile | `master_profiles` (+`linkedin` drafts), `personal_details`, `work_experiences`, `education_records`, `skills`, `certifications`, `languages`, `projects`, `master_profile_versions` |
| Resumes | `resume_documents`, `resume_versions`, `resume_sections`, `resume_templates`, `template_versions`, `country_rules`, `country_rule_sources` |
| Analysis | `job_descriptions`, `ats_results` |
| Letters/files | `cover_letters`, `uploaded_documents`, `import_jobs`, `document_exports` |
| AI | `ai_jobs` (queue), `ai_usage` |
| Billing | `subscription_plans`, `subscriptions`, `payments`, `entitlements`, `usage_quotas`, `coupons` |
| Ops | `audit_logs`, `support_requests`, `deletion_requests` |
| **Jobs (new, 0011)** | `job_preferences` (1 row/user), `job_pipeline` (saved/passed/ready/applying/applied/needs_you/interview/offer/rejected + listing snapshot) |
| **Community (new, 0011)** | `community_handles`, `community_posts`, `community_comments`, `community_reactions`, `community_reports` |

## Rules
- RLS on every public table. Owner tables: `user_id = auth.uid()`. Child rows use composite FK `(parent_id, user_id)` so a row can never point at another user's parent (`job_pipeline.tailored_resume_id` follows this).
- Documented exception: `community_comments.post_id` / `community_reactions.post_id` reference a *public* post by id only – community content is intentionally readable by all members.
- Community authors appear only as a server-generated handle (`ensure_community_handle()`); INSERT policies require `handle` = the caller's stored handle, so impersonation is impossible. `hidden` (moderation) is writable only by the service role. Reports have no SELECT policy.
- DB-side abuse limits: 10 posts and 60 comments per user per rolling day (trigger).
- Job listings are not stored globally; `job_pipeline.snapshot` (≤ 40 KB, validated) keeps what the user saved, filled from the server's own feed copy, never from client text.
- Entitlements/quotas are evaluated in server code (not triggers). Hardening idea for Phase 17: remove client INSERT policies on `ai_jobs`, `document_exports`, `resume_documents` so only `/api/v1` can create them.
- Storage: private bucket `resume-exports`; signed URLs (5 min).

## Verification status
Live cloud check (anon key): `resume_templates` readable; `job_pipeline`, `community_posts`, `community_reports`, `master_profiles` return `[]` to anonymous callers (RLS blocks). pgTAP/storage suites: not run (B10).
