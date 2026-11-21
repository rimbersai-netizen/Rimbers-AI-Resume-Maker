# Next Action

1. `node --version`. If missing: `pgrep -f "brew.rb reinstall node"` (still building) — task output at
   /private/tmp/claude-501/-Users-mak-Desktop-Resume-Maker/4b26c452-75dc-4565-b6d5-fbd55004efbb/tasks/bsc6eownb.output
2. `corepack enable && corepack prepare pnpm@9.15.9 --activate` → `pnpm install && pnpm check`.
   Pass → mark 1C VERIFIED and re-mark Bun-tested batches (4A, 4B, 9A–C, 6A–C engine parts, 14A) per evidence.
3. Re-run live Ollama benchmark when CPU is idle: `OLLAMA_LIVE=1 pnpm vitest run packages/ai-engine/src/ollama.live.test.ts`.
4. Restart local Supabase (stopped at 03:35 to relieve memory):
   `supabase start -x studio,realtime,edge-runtime,imgproxy,vector,logflare,supavisor,postgres-meta`
   then `supabase test db && bash supabase/tests/storage/storage-rls.test.sh` (regression).
5. 2B: code + tests written. Run: `pnpm --filter @gars/web typecheck`, `pnpm vitest run apps/web`, start Supabase WITH mailpit (drop mailpit from -x), `SUPABASE_IT=1 pnpm vitest run tests/integration`, then `pnpm --filter @gars/web build`. Auth config changed in supabase/config.toml (confirmations on, guests on, pw ≥10 upper/lower/digit, site 127.0.0.1:3100). Then 3A–3C, 4C, 5C, 10A.
