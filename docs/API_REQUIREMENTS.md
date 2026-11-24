# API / Credential Requirements

Nothing here has been requested or activated. All items need explicit user approval (CLAUDE.md "Protected" list).

| Need | Why | Status |
|---|---|---|
| Supabase cloud project (URL, anon key, service key) | staging/prod | Blocked B3 — local Supabase used meanwhile |
| Ollama + models (`qwen3:4b`, `llama3.2:3b`) | all AI features (local, free) | **Not installed on current Windows machine** (B10) |
| Docker Desktop | local Supabase, integration tests | **Not installed** (B10) |
| Moyasar test-mode keys (+ webhook secret) | sandbox payments (14B) | Blocked B5 |
| Apple Developer / Google Play accounts | store builds, IAP (16/19) | Blocked B5; not needed for local builds |
| Google OAuth client (Supabase Auth provider) | "Sign in with Google" | not configured |
| Authorized job-listing API (e.g. a partner/aggregator with a permitted ToS and API key) | job search; **no scraping** | not chosen — tracker works without it |
| Cloud LLM key (optional, off by default) | fallback only with per-user consent | not requested |
| Transactional email SMTP | production auth emails | local Mailpit only |
| Error monitoring (e.g. Sentry DSN) | admin/health | not chosen |
