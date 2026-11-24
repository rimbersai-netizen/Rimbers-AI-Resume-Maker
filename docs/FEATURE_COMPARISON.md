# Feature Comparison — Ours vs Rezi vs the product brief (2026-11-24)

Rezi column is from public pages only (see REZI_FEATURE_RESEARCH.md). Ours: ✅ verified (per checkpoints) · 🟡 implemented/partial/unverified here · ❌ missing.

| Capability | Rezi | Ours |
|---|---|---|
| Resume editor + live preview | ✅ | ✅ |
| Templates | ATS-oriented set | ✅ 105 distinct, PDF/DOCX/visual-tested |
| PDF export | ✅ | ✅ (Chromium worker) |
| Editable DOCX | reported | ✅ |
| ATS score + categories | ✅ 100-pt | ✅ |
| JD keyword targeting / tailoring | ✅ | ✅ (original preserved, no invented skills) |
| AI bullets/summary/grammar/tone | ✅ | ✅ fact-checked, accept/edit/reject |
| Cover letters | ✅ | ✅ + PDF/DOCX |
| AI Resume Agent (chat) | ✅ | ❌ |
| Interview practice | ✅ | ❌ |
| Job discovery: swipe feed with 0–100 match score, skills on/missing | ✅ (per reference screenshots) | 🟡 implemented web + Flutter (public feeds, explainable score); not E2E-verified |
| Application tracker (Ready/Applied/Needs you…) | ✅ (per screenshots) | 🟡 implemented; user applies on the employer page, no auto-submit |
| Job tailoring (strengths / optimizations / gaps, Apply selected) | ✅ (per screenshots) | 🟡 implemented; only user-ticked skills added, fact-checked AI summary |
| Job preferences onboarding (roles, pay, freshness) | ✅ | 🟡 implemented |
| Auto-apply (submits applications for you) | ✅ | ❌ by design (B12) |
| Community (wins, questions, resume feedback) | ✅ (new) | 🟡 implemented: anonymous handles, text-only, reports, rate limits |
| Mobile ↔ web sync | ✅ | ✅ same Supabase account + same `/api/v1` services |
| Resume import (PDF/DOCX) | ✅ | ❌ |
| LinkedIn tools | partial | 🟡 12B implemented |
| Resignation/professional emails, skills gap | – | ❌ |
| Country-specific CV rules (30) | – | ✅ (conventions await human review) |
| App-language ≠ resume-language, RTL/Arabic/Urdu export | – | ✅ export / 🟡 app UI switcher (13A) |
| Master profile reused across resumes | – | ✅ |
| Subscriptions/entitlements | ✅ | 🟡 server-side entitlements; no billing UI/payments |
| Admin dashboard | n/a | ❌ (apps/admin empty) |
| Android / iOS apps | ✅ (per screenshots) | 🟡 Flutter app built (APK compiles, 12/12 tests); iOS needs a Mac / paid cloud build |
| Local/private AI | cloud | ✅ Ollama-first (not runnable on current machine) |
