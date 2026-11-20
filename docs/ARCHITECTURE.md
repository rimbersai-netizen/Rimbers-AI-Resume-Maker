# Architecture

```
 apps/web (Next.js) ─┐                       ┌─ services/ai-worker ── Ollama (localhost only)
 apps/admin (Next.js)├─► Supabase (Auth, PG, ─┤                         └─ optional cloud adapter (off)
 apps/mobile (Expo) ─┘   RLS, Storage, Edge)  └─ services/document-worker ── Playwright/Chromium (PDF), docx (DOCX)
          │
          └── shared packages (pure TS, platform-agnostic)
```

## Packages (dependency direction: top depends on bottom)
| Package | Responsibility | Depends on |
|---|---|---|
| `shared-types` | Shared enums/ids/result types | — |
| `resume-schema` | Canonical Zod schema for master profile + resume document (the data contract) | shared-types |
| `validation` | Field validators (email, phone, URL, date ranges), sanitization | resume-schema |
| `country-rules` | Country convention configs + resolver | resume-schema |
| `template-engine` | Template specs, registry, HTML rendering | resume-schema, country-rules |
| `resume-builder` | Master profile → resume version projection, section ordering | resume-schema, country-rules |
| `ats-engine` | Heuristic analysis + JD matching | resume-schema |
| `ai-engine` | Provider interface, Ollama adapter, prompt contracts, output validation, fact checks | resume-schema |
| `document-engine` | Pagination model, PDF/DOCX generators (Node only) | template-engine |
| `localization` | Catalogs, locale/RTL helpers, date formats | — |
| `subscriptions` | Plans, quotas, entitlement evaluation | shared-types |
| `analytics` | Typed event definitions | shared-types |
| `ui` | Shared design tokens + web components | localization |

## Key decisions
- **Data contract first**: everything flows through `resume-schema`. Web, mobile, workers and edge functions validate with the same Zod schemas.
- **AI never on client**: clients enqueue `ai_jobs` rows; the ai-worker (trusted, service-role) polls, calls Ollama on localhost, validates JSON output, writes results. Ollama is never exposed publicly.
- **Fact traceability**: every AI suggestion carries `sourceFieldIds`; a deterministic checker flags new numbers, dates, orgs, or skills not present in source.
- **Documents**: one HTML/CSS render path → Chromium PDF. DOCX built from the same structured model (not from HTML screenshots).
- **Hosting**: web/admin can be on Vercel-like Node hosting; workers need a persistent host (VPS/container). Shared hosting (e.g. Hostinger shared) cannot run workers or Ollama.
- **Security**: RLS on every user table (`user_id = auth.uid()`); admin via `admin_roles` + MFA; private storage buckets + signed URLs; payment webhooks HMAC-verified and idempotent.

## Design system (summary)
- Tokens: neutral slate scale, one brand accent (indigo-600), semantic success/warn/danger.
- Type: Inter (Latin), Noto Sans Arabic / Noto Nastaliq Urdu (RTL), Noto Sans JP/SC/Devanagari.
- 4px spacing grid; WCAG 2.2 AA contrast; logical CSS properties (`margin-inline-start`) for RTL.
