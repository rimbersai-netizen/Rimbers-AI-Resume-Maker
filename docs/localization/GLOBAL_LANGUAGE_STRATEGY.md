# Global Language Strategy

## Two independent settings
| Setting | Stored in | Controls | Never changed by |
|---|---|---|---|
| **App language** | `profiles.app_locale` + `app_locale_source` (server), secure device storage (guest) | menus, buttons, forms, notifications, help, settings | country selection, resume language |
| **Resume language** | `resume_documents.locale` (per resume version) | CV text, summaries, experience, cover letters, LinkedIn copy | app language |

**Country** (`resume_documents.country_code`) controls formatting conventions (page size, dates,
section order, photo, personal info) — independent of both languages. It may *suggest* a resume
language; it never sets the app language.

## App-language resolution (first match wins)
1. **Saved manual choice** (`app_locale_source = 'manual'`) — never overwritten on later launches.
2. **Device locale**, if supported (match `ll-RR` exactly, then base `ll`; e.g. `pt-BR`→`pt-BR`/`pt`, `de-AT`→`de`).
3. **Country preference** — only when the device reports **no language at all** (e.g. a web client with
   no `Accept-Language`). An *unsupported* device language (e.g. Swahili speaker in Saudi Arabia) gets
   English, not the country's language — guessing Arabic there would be forcing it. Multilingual countries
   (IN, CH, CA, SG, MY, PH) never suggest a language. Saudi Arabia/Pakistan never force ar/ur.
   Implemented in `packages/localization/src/resolve.ts`.
4. **English** fallback.

The resolved value is saved with its source (`device` / `country` / `default`); only an explicit user
pick writes `manual`. Signing in merges guest → account: a `manual` value wins over a non-manual one.

## Supported locales (initial)
`en` (default + universal fallback), `ar`*, `ur`*, `hi`, `fr`, `de`, `es`, `pt`, `it`, `tr`, `zh` (`zh-Hans`), `ja`.
\* RTL. Region variants (e.g. `pt-BR`, `es-MX`, `en-GB`) map to their base catalog unless a variant catalog exists.

## Catalogs and fallback
- Message catalogs per locale in `packages/localization/catalogs/<locale>.json`, ICU MessageFormat (plurals, gender).
- Any missing key falls back **per key** to English — never show raw keys or blank text.
- Each catalog records coverage % and status: `machine` (unreviewed) / `reviewed` / `verified`.
  The UI only lists a language as fully supported when coverage = 100% and status ≥ `reviewed`;
  otherwise it is labelled "Beta". Machine translations are never reported as verified.
- CI check (13C): key parity, placeholder parity, ICU syntax validity, coverage report.

## RTL
- App: `I18nManager.forceRTL` (RN) / `dir="rtl"` (web) on language switch; RN requires a reload, so
  prompt and restart the JS bundle.
- Documents: RTL determined by **resume language**, not app language. PDF uses `dir="rtl"` + Arabic/Urdu
  fonts with shaping; DOCX sets `w:bidi` on paragraphs and `w:rtl` on runs.
- Mixed text (English tech terms, emails, URLs, phone numbers in Arabic CVs) isolated with
  `<bdi>` / Unicode FSI…PDI so they keep LTR order.

## Required tests (13A–13C, 16C)
English first launch · Arabic device → ar · Urdu device → ur · German device → de ·
unsupported device (e.g. `sw`) → en · manual change persists across relaunch · country change
(SA, PK) does not change app language · app=en with resume=ar renders RTL PDF/DOCX ·
guest→account merge keeps manual choice · RTL layout snapshots on small (SE) and large (Pro Max / Pixel XL) screens.
