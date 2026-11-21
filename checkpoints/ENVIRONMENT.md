# Environment Audit (Batch 1A) — 2026-11-21

| Item | Value | Notes |
|---|---|---|
| OS | macOS 26.7 (25G220) | |
| CPU | Intel Core i7-9750H, x86_64, 6C/12T | No Apple Silicon / Metal acceleration for LLMs |
| RAM | 16 GB | Run at most ONE local LLM at a time; no parallel heavy builds |
| Disk | 26 GB free of 466 GB (95% used) | **Risk**: Expo/Android/iOS builds + Playwright browsers need ~10–15 GB. Keep caches lean. |
| Node | Homebrew node **26.13.1** (compiled from source 02:33–04:00; no bottle for Intel + macOS 26) | Working |
| npm / pnpm | npm 11.20.0; **pnpm 9.15.9** via `npm i -g` (Node 26 has no corepack) | |
| Git | 2.50.1 | NOTE: `/Users/mak` is itself a git repo. This project has its **own** repo at `global-ai-resume-studio/` — never commit to the home repo. |
| Python | 3.15.2 | |
| Docker | 29.9.2 CLI; daemon **not running** | Needed for `supabase start` (local Postgres). Start Docker Desktop manually. |
| Android SDK | ~/Library/Android/sdk (platforms, build-tools, emulator, ndk) ; adb 1.0.41 | Java 17 available |
| Xcode | 26.3 (17C529) | iOS simulator builds possible |
| Ollama | 0.40.16, server running on :11434 | Models: qwen3.5:4b, qwen3:4b, llama3.2:3b, jarvis-qwen3-direct:4b, moondream, qwen3-embedding:0.6b |
| Supabase CLI | 3.2.0 | No project linked. Dedicated project required (not created — needs user account authorization). |
| Bun / Deno | present | Not used by this project |

## Model choice (initial, to be benchmarked in 7A)
- Primary writing model: `qwen3:4b` / `qwen3.5:4b` (fits 16 GB, CPU inference).
- Fallback small model: `llama3.2:3b`.
- Embeddings (keyword/semantic matching): `qwen3-embedding:0.6b`.
- Expect slow CPU inference (several tokens/s) → all AI calls must be async jobs with timeouts.

## Model benchmark (2026-11-21, CPU idle, short summary task)
| Model | Time | Faithful? | Decision |
|---|---|---|---|
| qwen3:4b | ~32 s | yes | **primary** |
| llama3.2:3b | ~21 s | no — invented "4+ years" (blocked by factCheck) | fallback only |
