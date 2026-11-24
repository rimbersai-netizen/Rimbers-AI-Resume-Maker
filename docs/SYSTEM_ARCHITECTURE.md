# System Architecture (updated 2026-11-24)

Detailed package table and decisions: `ARCHITECTURE.md`. This page is the current, as-built picture.

```
 Flutter app (apps/mobile) ──┐  bearer JWT                                  ┌─ services/ai-worker ─ Ollama 127.0.0.1 (qwen3:4b / llama3.2:3b)
                             ├─► apps/web (Next.js 15)  ──► Supabase ───────┤
 Browser (apps/web pages) ───┘   /api/v1/* + server actions   Auth, PG, RLS,  └─ services/document-worker ─ Chromium (PDF) + docx (DOCX)
                                 └─ lib/services/* (shared)    Storage (private buckets)
                                 └─ public job feeds (Remotive, Arbeitnow) – fetched server-side, cached 6 h
```

## One rule set, two clients
Web server actions and the mobile app's `/api/v1` routes call the **same** functions in `apps/web/src/lib/services/*`
(`ai`, `profile`, `resumes`, `render`, `jobs`, `community`). Validation (Zod via `@gars/resume-schema`), plan limits
(`@gars/subscriptions evaluate()`), and fact-checking therefore cannot differ between web and mobile.

## Request flows
- **Auth**: Supabase email auth. Web uses SSR cookies; mobile sends the access token as `Authorization: Bearer`. API routes build a Supabase client *as the caller* – RLS always applies.
- **AI**: client → `ai_jobs` row (after quota check) → ai-worker claims (service role) → Ollama → fact-check gate → output stored → client polls. Clients never reach Ollama.
- **Export**: `document_exports` row → document-worker renders (same `renderResumeHtml` + `@gars/fonts` as preview) → private bucket → short-lived signed URL.
- **Jobs**: `GET /api/v1/jobs` loads listings from public feeds (cache 6 h, stale-on-error), filters by saved preferences, scores each against the user's profile with `@gars/ats-engine` `scoreJob` (deterministic, explainable). Saving/passing/applying writes `job_pipeline` with a server-side snapshot of the listing.
- **Tailoring**: `tailorPlan` → strengths / optimizations / gaps. "Apply selected" adds only skills the user ticked (validated against the server's own plan), creates a resume for the role, queues the existing fact-checked `tailor_resume` AI job, then stores the summary on that resume only (`summaryOverride`).
- **Community**: anonymous server-generated handles, text-only posts (links/emails/phones rejected), rate limits in the DB, reports table readable only by moderators.

## Not built / out of scope here
Admin dashboard (`apps/admin` empty), payments (sandbox only, not wired), resume import, interview prep, iOS binaries (cannot build on Windows), auto-submitting applications to employers (we do not do this: the user applies on the employer's page).

## Billing (Moyasar, added 2026-11-24 at the user's explicit request; LIVE keys configured)
`apps/web/src/lib/services/billing.ts`. Hosted Moyasar **invoices**: card data never touches our servers or the mobile app.
1. `POST /api/v1/billing/checkout {plan, period}` (also the `/pricing` page): the **server** reads the price from `subscription_plans`, creates the invoice (secret key, Basic auth) and returns its https URL; an `initiated` row is written to `payments` (service role).
2. After payment the user lands on `/billing/success` (web) or returns to the app (mobile calls `POST /api/v1/billing/confirm`). Both re-read the invoice **from Moyasar** with the secret key; redirect query strings are never trusted.
3. Activation is idempotent (unique `provider+provider_subscription_id`, one payment row per payment); amount, currency, owner (`metadata.user_id`) and plan must match what we charged. Paying again before expiry extends from the current period end. Refunds seen on re-sync expire the plan.
4. `POST /api/webhooks/moyasar` (needs a public HTTPS URL): constant-time check of the shared `secret_token` (`MOYASAR_WEBHOOK_SECRET`), then the same re-fetch + idempotent sync.
Each payment is a one-time charge for one period (no stored cards, no auto-renewal); the plan ends at the period end unless the user pays again.
Config (git-ignored `apps/web/.env.cloud`, server-only): `MOYASAR_SECRET_KEY`, `MOYASAR_PUBLISHABLE_KEY` (unused by invoices), `MOYASAR_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`. Prices (SAR halalas) live in migration `20261124000012`: Standard 19/159, Professional 39/279, Premium 59/429 per month/year — change by updating those rows.
Verified: 12 unit tests with a mocked Moyasar API + in-memory DB; invoice payload accepted by Moyasar in TEST mode (no money). **No live charge has been made by us.**
