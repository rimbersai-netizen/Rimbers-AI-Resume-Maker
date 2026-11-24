# Blockers

| # | Blocker | Impact | Needed from user |
|---|---|---|---|
| B3 | No dedicated Supabase cloud project | Staging/prod only | Create + provide keys when ready (approval gate) |
| B4 | Disk: 35 GB free after Node build | Mobile builds + Playwright browsers need ~10–15 GB | Free 20+ GB before Phase 16 |
| B5 | Moyasar / Apple / Google billing accounts | Phase 14 live billing | Test-mode keys + approval |
| B6 | CPU-only LLM inference (Intel) | Slow AI jobs | None (async queue) |
| B8 | Arabic/Urdu PDFs: shaped glyphs carry text via /ActualText (standard). Readers that ignore ActualText (pdf.js, some ATS parsers) lose those letters. | ATS parsing of Arabic/Urdu resumes may be partial | None — mitigated by recommending an English version for GCC/PK (country notes). Revisit with a font whose shaped glyphs map to presentation forms. |
| B9 | Playwright 1.49 browser installer hangs on Node 26 (zip extraction) | New machines/CI need the manual extract or CHROMIUM_EXECUTABLE | Pin Node 22 LTS in CI/production, or upgrade Playwright |

Resolved: B1 Node — Homebrew node 26.13.1 built (04:00). B2 Docker — running (2026-11-21). B7 — user confirmed `Showcase.png` is the second reference (2026-11-21).

| B10 | Workspace moved to Windows 11: no Docker, no Ollama, Chromium/Android SDK unverified, ~3.7 GB free RAM at audit; Xcode impossible | pgTAP, storage, SUPABASE_IT, PDF_IT, live AI, mobile builds cannot run here | Install Docker Desktop + Ollama (qwen3:4b, llama3.2:3b) + Playwright Chromium, or continue on the Mac. iOS builds need a Mac. |
