# Next Action

1. Confirm `node --version` works (Homebrew source build of node 26 may still be running: `pgrep -fl "brew.rb reinstall node"`).
2. `corepack enable && corepack prepare pnpm@9.15.9 --activate` (or `npm i -g pnpm@9.15.9`).
3. In repo root: `pnpm install && pnpm check`. Fix failures; record output in TEST_RESULTS.md.
4. Mark 1B + 1C VERIFIED, commit.
5. Start Phase 2A: `supabase init` in repo, write migration `0001_core.sql` for tables listed in docs/ARCHITECTURE + master prompt §20. Requires Docker running to verify with `supabase start` + `supabase db reset`.
