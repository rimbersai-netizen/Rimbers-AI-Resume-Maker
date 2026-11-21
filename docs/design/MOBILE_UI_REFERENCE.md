# Mobile UI Reference

Source images (user-supplied, official visual direction for Android + iOS):

| File | Contents |
|---|---|
| `reference/showcase-a-flows.png` | 12 screens: Home/Welcome, Country & Language, Personal Details, Education & Skills, Job Match, AI Summary, Template Customization, Export, Cover Letter, LinkedIn, My Resumes, Account Settings |
| `reference/showcase-b-screens.png` | 12 screens: Onboarding, Sign In/Up, Dashboard, Profile Builder, Work Experience, AI Writing Assistant, Template Gallery, Editor + Live Preview, ATS Analysis, Export Options, Subscription Plans, Settings |

These are **visual references only** — never embed them as screenshots in the app. Persons, names
and sample data shown in them are placeholders; do not ship them as real content.

## Screen → reference → batch map

| # | Screen | Reference | Implemented in batch |
|---|---|---|---|
| 1 | Splash | logo mark on lavender | 16A |
| 2 | Onboarding (4 dots, Skip, Get Started) | B-1 | 16A |
| 3 | Sign in / Sign up (email, Google, Apple) | B-2 | 16A (uses 2B auth) |
| 4 | Forgot password | derived from B-2 | 16A |
| 5 | Home dashboard (greeting, Create New Resume card, 4 tool tiles, My Resumes) | B-3, A-1 | 16B |
| 6 | Country & language selection (searchable flag list, resume language) | A-2 | 16B (uses 4C, 13A) |
| 7 | Personal profile builder (4-step stepper, photo optional) | B-4, A-3 | 16B (uses 3A) |
| 8 | Work experience editor (dates, "currently work here", bullets w/ counter) | B-5 | 16B (uses 3B) |
| 9 | Education & skills editor (chips with remove) | A-4 | 16B (uses 3B) |
| 10 | AI writing assistant (Summary/Experience/Skills tabs, tone, generate) | B-6, A-6 | 16C (uses 8A–8C) |
| 11 | Job description matching (paste JD, 2,000 counter, match ring) | A-5 | 16C (uses 9B) |
| 12 | ATS analysis (score ring, category rows, recommendations) | B-9 | 16C (uses 9C) |
| 13 | Template gallery (search, filter chips, favourites) | B-7 | 16B (uses 6C) |
| 14 | Resume customization (color, font, layout, spacing) | A-7 | 16B |
| 15 | Live resume editor (Edit/Preview toggle, bottom toolbar) | B-8 | 16B (uses 5C) |
| 16 | Resume preview | B-8 | 16B |
| 17 | PDF/DOCX export (format choice, ready state, share) | B-10, A-8 | 16C (uses 10A/10B) |
| 18 | Cover letter generator | A-9 | 16C (uses 12A) |
| 19 | LinkedIn assistant (Profile/Headline/About/Skills, copy, open LinkedIn) | A-10 | 16C (uses 12B) |
| 20 | Saved resumes (filter: All/CV/Resume, country + language meta) | A-11 | 16B |
| 21 | Subscription plans (Monthly/Yearly toggle, plan cards) | B-11 | 16C (uses 14C) |
| 22 | Account settings | A-12, B-12 | 16C |
| 23 | Privacy & security (password, 2-step, download/delete data) | A-12 | 16C (uses 17B) |
| 24 | Help & support | A-12 | 16C |

Every screen also needs loading, empty, validation-error, offline and server-error states.

## Fidelity notes / deliberate deviations
- Reference shows "Saudi Arabia" pre-selected with English resume language — matches our rule that
  country never forces language.
- Reference "92% Match" / "92/100" — our ATS copy must say "estimated" and never "guaranteed".
- AI suggestion panels must add **Accept / Edit / Reject** and a "verify facts" notice (product rule).
- Phone fields show country dial code from the selected country; still user-editable.
