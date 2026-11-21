# Mobile Design System (derived from reference images)

Implemented as tokens in `packages/ui` (shared web + mobile) during 16A. Values are sampled
approximations of the references; tune visually against them, then lock with snapshot tests.

## Color tokens
| Token | Light | Dark (planned) | Use |
|---|---|---|---|
| `bg.canvas` | `#F7F5FF` | `#0F1024` | Screen background (very light lavender) |
| `bg.surface` | `#FFFFFF` | `#181A36` | Cards, inputs |
| `bg.subtle` | `#EFEBFF` | `#232552` | Selected chip, tab track |
| `header.navy` | `#151A45` | `#151A45` | Top app bar (flow screens, showcase A) |
| `text.primary` | `#141A3C` | `#F2F2FA` | Headings (dark navy) |
| `text.secondary` | `#5B6178` | `#A9ADC6` | Body/help text |
| `text.inverse` | `#FFFFFF` | `#FFFFFF` | On gradient/navy |
| `brand.500` | `#6D3BEF` | `#8B6BFF` | Links, icons, active tab |
| `brand.gradient` | `#5B2EE8 → #8A55F7` (left→right) | same | Primary buttons, hero card |
| `border.default` | `#E4E1F2` | `#2E3060` | Inputs, cards |
| `success` | `#22C55E` | `#34D399` | Checkmarks, score ring ≥80 |
| `warning` | `#F59E0B` | `#FBBF24` | Score 50–79 |
| `danger` | `#E5484D` | `#F87171` | Delete, Sign out, errors |

Contrast: `text.primary`/`bg.canvas` and white/`brand.gradient` start colour must meet WCAG AA (4.5:1) — verify in 18B.

## Typography
- Latin: Inter (400/500/600/700). Arabic: Noto Sans Arabic / IBM Plex Sans Arabic. Urdu: Noto Nastaliq Urdu
  (needs ~1.6× line height). Hindi: Noto Sans Devanagari. CJK: Noto Sans SC / Noto Sans JP.
- Scale (pt): display 28/34 · title 22/28 · headline 18/24 · body 15/22 · label 13/18 · caption 11/14.
- Respect OS dynamic type up to 200%; layouts must not clip.

## Shape, spacing, elevation
- 4-pt grid; screen gutter 16; card padding 16; section gap 24.
- Radius: card 16 · input 12 · button 14 · chip 999 · phone-mockup thumbnails 8.
- Elevation: one soft shadow `0 4 16 rgba(40,30,110,0.08)`; selected card = 2 px `brand.500` border + check badge.

## Components
Primary gradient button (with trailing → arrow, mirrored in RTL) · secondary outline button ·
text input (label above, required `*`, counter `n / max`) · phone input (flag + dial code) ·
dropdown/select · stepper (numbered circles, "of 5") · segmented tabs · filter chips · removable skill chips ·
country row (flag, native name, check) · resume card (thumbnail, title, country · language, updated, ⋯ menu) ·
template thumbnail (favourite heart, selected check) · score ring · category score row · plan card ·
settings row (icon, title, subtitle, chevron/toggle/value) · bottom tab bar (Home, Resumes/Templates, Tools, Profile) ·
toast, skeleton loader, empty state, error banner.

## Motion
150–250 ms ease-out for presses/tabs; shared-element transition template thumbnail → preview;
honour "Reduce Motion".

## RTL rules
Use logical start/end everywhere. Mirror: back arrows, chevrons, → on buttons, stepper direction,
progress bars. Do **not** mirror: logo, photos, flags, phone numbers, digits, brand icons (LinkedIn, PDF/DOCX), the score ring.
