# Blockers

| # | Blocker | Impact | Needed from user |
|---|---|---|---|
| B1 | Homebrew is compiling Node 26.13.1 from source (no bottle for Intel + macOS 26). `node` is unavailable until it finishes. | Blocks 1C verification, 2B, all app work | None — wait |
| B3 | No dedicated Supabase cloud project | Staging/prod only | Create + provide keys when ready (approval gate) |
| B4 | Disk: 15 GB free and falling during Node build | Mobile builds + Playwright browsers need ~10–15 GB | Free 20+ GB before Phase 16 |
| B5 | Moyasar / Apple / Google billing accounts | Phase 14 live billing | Test-mode keys + approval |
| B6 | CPU-only LLM inference (Intel) | Slow AI jobs | None (async queue) |
| B7 | Reference image "Showcase(2).png" not found; used `Showcase.png` (identical to `Showcase-1.png`) as the second reference | Confirm correct image | Confirm |

Resolved: B2 Docker — running (2026-11-21).
