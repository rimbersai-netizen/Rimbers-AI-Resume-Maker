# Next Action

1. `node --version` — if missing, check `pgrep -f "brew.rb reinstall node"` (source build in progress).
2. `corepack enable && corepack prepare pnpm@9.15.9 --activate`; `pnpm install && pnpm check` → mark 1C VERIFIED.
3. 2C: add storage policy tests (curl/supabase-js: user A upload to own folder OK, to B's folder denied; signed URL works only for owner), mark VERIFIED.
4. 2B: scaffold `apps/web` (Next.js) with @supabase/ssr: sign-up, email verify (local Mailpit — currently excluded from `supabase start`; include it), sign-in, reset password, sign-out, guest session, account deletion request, data export request. Tests.
5. Then Phase 3A.

Local Supabase for THIS project: ports 554xx (API 55421, DB 55422). Start with:
`supabase start -x studio,realtime,edge-runtime,imgproxy,vector,logflare,supavisor,mailpit,postgres-meta`
Another project (chef-orhan-ai-recipes) uses the default 543xx ports — do not stop it.
