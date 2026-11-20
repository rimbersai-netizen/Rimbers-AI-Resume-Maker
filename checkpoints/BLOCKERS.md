# Blockers

| # | Blocker | Impact | Needed from user |
|---|---|---|---|
| B1 | Homebrew Node was broken (llhttp mismatch). `brew reinstall node` is compiling Node 26.13.1 from source (no bottle for Intel + macOS 26). | Blocks `pnpm install`/tests until done | None — wait for build |
| B2 | Docker daemon not running | Blocks `supabase start` (Phase 2 local DB) | Start Docker Desktop |
| B3 | No dedicated Supabase cloud project | Staging/prod only; local dev unaffected | Create project + provide keys when ready (approval gate) |
| B4 | Disk ~26 GB free (95% used) | Mobile builds + Playwright browsers may run out | Free 20+ GB recommended before Phase 16 |
| B5 | Moyasar / Apple / Google billing accounts | Phase 14 live billing | Test-mode keys + approval |
| B6 | CPU-only LLM inference (Intel, no Metal) | Slow AI jobs; async queue required | None |
