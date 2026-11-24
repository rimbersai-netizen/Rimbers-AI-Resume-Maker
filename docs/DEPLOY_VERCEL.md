# Deploying the web app to Vercel

Repo: whole monorepo (the web app imports `packages/*`). Nothing secret is committed; all keys are Vercel environment variables.

## Vercel project settings
1. Import the GitHub repo. **Root Directory: `apps/web`**. Framework: Next.js (auto).
2. Keep **"Include source files outside of the Root Directory in the Build Step" enabled** (the build imports `packages/*` and runs `pnpm -w gen:fonts` from the repo root).
3. Install/build commands: leave defaults (Vercel detects pnpm 9 from `packageManager`). Node 20+.

## Environment variables (Production + Preview)
| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://kexkcfqcfwclmtmzprif.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon key |
| `NEXT_PUBLIC_SITE_URL` | your Vercel https URL (no trailing slash) |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (server only) |
| `MOYASAR_SECRET_KEY` | `sk_live_…` (server only) |
| `MOYASAR_PUBLISHABLE_KEY` | `pk_live_…` |
| `MOYASAR_WEBHOOK_SECRET` | random string, same value as in the Moyasar dashboard |

## After the first deploy
- **Supabase → Authentication → URL Configuration:** set Site URL to the Vercel URL and add `https://<your-domain>/auth/callback` to Redirect URLs.
- **Moyasar dashboard → Webhooks:** URL `https://<your-domain>/api/webhooks/moyasar`, secret = `MOYASAR_WEBHOOK_SECRET`.
- **Google sign-in:** add `https://<your-domain>` under Authorized JavaScript origins if Google asks (redirect URI stays the Supabase `/auth/v1/callback`).
- Email OTP: Supabase email templates must contain `{{ .Token }}`; add a custom SMTP provider for real traffic.
- Mobile app: build with `--dart-define=API_BASE_URL=https://<your-domain>`.

## Important: what Vercel does NOT run
Vercel hosts the website and `/api/v1`. These are long-running processes and must run elsewhere (a small VPS / Railway / Render / Fly, or your own always-on PC):
- `services/ai-worker` — processes AI jobs (Gemini first, Ollama fallback). **Without it, AI buttons queue forever.**
- `services/document-worker` — renders PDF/DOCX with Chromium. **Without it, exports never finish.**
Both read `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (and `GEMINI_API_KEY`, `AI_PROVIDER=gemini` for the AI worker). Moving AI jobs into a Vercel cron/serverless route is possible later (Gemini only, no Ollama).
