# Mobile Development Status (updated 2026-11-24)

Flutter (Android + iOS from one codebase), `apps/mobile`. Riverpod, go_router, supabase_flutter, http, webview_flutter, share_plus, url_launcher. Talks to the web backend `/api/v1` with the Supabase access token. Config via `--dart-define=SUPABASE_URL / SUPABASE_ANON_KEY / API_BASE_URL`.

## Screens (compile + unit-tested; **none verified against a live backend**)
| Area | Screens |
|---|---|
| Account | Onboarding, sign in / up / forgot password, settings, plans (read-only; purchasing not enabled) |
| Home (5 tabs) | Home · **Jobs** · Resumes · **Community** · Profile; "All tools" page |
| Resumes | New (country/language/template), editor (preview WebView, style, sections reorder/toggle/rename, export + share), ATS + JD match |
| Profile | 4-step builder with server-side validation messages |
| AI tools | AI writer, cover letters (generate/edit/export), LinkedIn assistant |
| **Jobs (new, from the reference screenshots)** | Preferences (roles → work style → pay & freshness) · **Discover** swipe cards (drag or buttons, undo) with 0–100 match bar, "On your resume" / "To grow" skills, role details sheet · **Saved** · **Applications** (Ready, Applying, Needs you, Applied, Interview, Offer, Rejected) · **Tailor** (strengths / optimizations / gaps, tick to add, "Apply selected" → new resume + fact-checked summary) |
| **Community (new)** | Feed with filters (wins / questions / feedback / discussion), new post, thread with replies, like, report, delete own |

## Deliberate differences from the Rezi screenshots
- **No auto-submit.** Rezi's "auto apply" submits applications on the user's behalf; we do not. Right-swipe adds a job to *Applications → Ready*; the user applies on the employer's own page and updates the status. Reasons: honesty (we cannot verify third-party forms), employer terms, and no fake "Submitted" states.
- Job data comes from public feeds (Remotive, Arbeitnow) with source attribution and a link to the original posting, not company career pages.
- Match scores are explainable estimates from skills / role title / years found in the posting and the user's profile.

## Checks run (Windows)
`flutter analyze`: 0 errors, 0 warnings (81 infos from newer SDK deprecations). `flutter test`: 12/12. `flutter build apk --debug`: see TESTING_REPORT.md. Widget/layout test caught and fixed an overflow in the match bar.

## Not done
Live E2E on an emulator (needs a signed-up account – creating accounts in the cloud project was not authorised), photo upload, resume duplicate/rename, push notifications, Android release signing, **iOS build (needs a Mac or a paid cloud build service – needs approval)**.

## 2026-11-24 — Rimbers UI refresh (from `images/Rimbers AI Resume Maker UI.png` + `Showcase.png`)
Rebranded to **Rimbers AI Resume Maker** (blue palette, drawn "R" logo) on web and mobile. Bottom bar is now Home · Templates · **+** (new resume) · Jobs · Profile; Resumes list, Community and All tools moved to routes reachable from Home/Profile. New: Home (greeting, "Create Resume with AI" banner, quick tools, Your Resumes), **Templates gallery** (search, categories, select → "Use This Template" pre-selects it in the new-resume flow), **Job Search list** (search + Remote / Full-time / Strong-match filters, save), Profile (plan chip, upgrade card, menu with counts, log out). Web: top nav, redesigned home, `/templates`, landing page.
Not built from the mockups, on purpose: Google/Apple sign-in buttons (need provider accounts/consoles = approval), notification bell (no notifications feature), Interview Prep (shown as "Soon"), "Premium plan / AI usage 65 per month" figures (no billing data yet; Profile shows the real plan only). Template thumbnails are stylised stand-ins (no template images exist). Editor/ATS/cover-letter screens inherit the new palette but keep their earlier layouts. Visual check: web landing + templates screenshotted in headless Chrome; mobile checked by analyze/tests/APK build only (no emulator run).

## 2026-11-24 (late) — OTP + closer Rimbers UI
- **Email OTP** replaces confirm-by-link: sign-up → 6-digit code screen (`/verify`), plus passwordless "Email me a sign-in code" (`/sign-in/code`) on web and Flutter; resend with 60 s cooldown, generic errors. **Requires the Supabase email templates to contain `{{ .Token }}`** (Authentication → Email Templates → "Confirm signup" and "Magic Link"); until then Supabase still emails a link, not a code. Not tested end to end (needs the template change + a real inbox).
- UI pass toward the mockups: wave/blob canvas background, 24-px shadowed cards, pill navy-gradient buttons, welcome screen with logo + resume/orbit art, "Welcome Back 👋" sign-in, AI mascot on the home banner, editor tabs Content · Design · Export · Preview with a "Preview Resume" button. Checked by rendering the Flutter web build in headless Chrome (welcome, sign-in, code screens) and the web sign-in page; post-login screens could not be screenshotted (no account; the phone was locked).
