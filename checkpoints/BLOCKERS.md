# Blockers

| # | Blocker | Impact | Needed from user |
|---|---|---|---|
| B3 | No dedicated Supabase cloud project | Staging/prod only | Create + provide keys when ready (approval gate) |
| B4 | Disk: 35 GB free after Node build | Mobile builds + Playwright browsers need ~10–15 GB | Free 20+ GB before Phase 16 |
| B5 | Moyasar / Apple / Google billing accounts | Phase 14 live billing | Test-mode keys + approval |
| B6 | CPU-only LLM inference (Intel) | Slow AI jobs | None (async queue) |

Resolved: B1 Node — Homebrew node 26.13.1 built (04:00). B2 Docker — running (2026-11-21). B7 — user confirmed `Showcase.png` is the second reference (2026-11-21).
