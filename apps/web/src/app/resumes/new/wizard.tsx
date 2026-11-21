"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listCountryRules } from "@gars/country-rules";
import { countryLabel, defaultLayout, flag, localeLabel, override, recommendationNotes, RESUME_LOCALES, type ResumeLayout } from "@/lib/resume-settings";
import { createResume } from "../actions";

export function NewResumeWizard(p: { appLocale: string; initialCountry: string | null; hasPhoto: boolean; profileReady: boolean }) {
  const router = useRouter();
  const countries = useMemo(() => listCountryRules().map((r) => ({ code: r.countryCode, name: countryLabel(r.countryCode), native: r.name }))
    .sort((a, b) => a.name.localeCompare(b.name)), []);
  const [query, setQuery] = useState("");
  const [layout, setLayout] = useState<ResumeLayout | null>(p.initialCountry ? defaultLayout(p.initialCountry, p.appLocale, { hasPhoto: p.hasPhoto }) : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; upgrade?: boolean } | null>(null);

  const filtered = countries.filter((c) => !query.trim() || `${c.name} ${c.native} ${c.code}`.toLowerCase().includes(query.trim().toLowerCase()));
  const pick = (code: string) => setLayout((l) => {
    const fresh = defaultLayout(code, p.appLocale, { hasPhoto: p.hasPhoto });
    // Keep a language the user already chose explicitly.
    return l?.settings.overridden.includes("locale") ? override(fresh, "locale", l.locale) : fresh;
  });
  const suggested = layout ? listCountryRules().find((r) => r.countryCode === layout.countryCode)?.suggestedResumeLocales.filter((l) => RESUME_LOCALES.includes(l)) ?? [] : [];
  const others = RESUME_LOCALES.filter((l) => !suggested.includes(l));

  const submit = async () => {
    if (!layout) return;
    setBusy(true); setError(null);
    const r = await createResume(layout);
    setBusy(false);
    if (r.ok) router.push(`/resumes/${r.value.id}`);
    else setError({ message: r.message, upgrade: r.kind === "entitlement" });
  };

  return (
    <div className="builder">
      <header className="builder-head">
        <Link href="/dashboard" className="muted">← Dashboard</Link>
        <h1>Set up your resume</h1>
        <p className="muted">Choose where you are applying. We suggest local conventions — you can change anything.</p>
      </header>
      {!p.profileReady && (
        <div className="alert error" role="status">Your profile is empty. <Link href="/profile">Complete your profile</Link> first so the preview has content.</div>
      )}

      <section className="card wide" aria-labelledby="c-title">
        <h2 id="c-title"><span className="step-dot">1</span> Target country</h2>
        <label htmlFor="country-search" className="visually-hidden">Search country</label>
        <input id="country-search" type="text" className="search" placeholder="Search country…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <ul className="country-list" role="listbox" aria-label="Countries">
          {filtered.map((c) => (
            <li key={c.code} role="option" aria-selected={layout?.countryCode === c.code}>
              <button type="button" onClick={() => pick(c.code)} className={layout?.countryCode === c.code ? "selected" : ""}>
                <span className="flag" aria-hidden>{flag(c.code)}</span>
                <span>{c.name}</span>
                {layout?.countryCode === c.code && <span className="check" aria-hidden>✓</span>}
              </button>
            </li>
          ))}
          {filtered.length === 0 && <li className="empty">No match. Other countries use international defaults — more are coming.</li>}
        </ul>
      </section>

      {layout && (
        <section className="card wide" aria-labelledby="l-title">
          <h2 id="l-title"><span className="step-dot">2</span> Resume language</h2>
          <p className="muted small">This is the language of the resume itself. The app stays in {localeLabel(p.appLocale)}.</p>
          <label htmlFor="resume-locale" className="visually-hidden">Resume language</label>
          <select id="resume-locale" value={layout.locale} onChange={(e) => setLayout(override(layout, "locale", e.target.value))}>
            <optgroup label={`Common in ${countryLabel(layout.countryCode)}`}>
              {suggested.map((l) => <option key={l} value={l}>{localeLabel(l)}</option>)}
            </optgroup>
            <optgroup label="All languages">
              {others.map((l) => <option key={l} value={l}>{localeLabel(l)}</option>)}
            </optgroup>
          </select>
          <h3>What we’ll suggest for {countryLabel(layout.countryCode)}</h3>
          <ul className="notes">{recommendationNotes(layout.countryCode).map((n) => <li key={n}>{n}</li>)}</ul>
          <p className="muted small">These are common hiring conventions, not legal requirements. Every one can be changed in the editor.</p>
          <label htmlFor="title">Resume name</label>
          <input id="title" type="text" value={layout.title} maxLength={200} onChange={(e) => setLayout({ ...layout, title: e.target.value })} />
          {error && <div className="alert error" role="alert">{error.message}{error.upgrade && <> <Link href="/account">See plans</Link></>}</div>}
          <button type="button" className="btn" disabled={busy || !layout.title.trim()} onClick={submit}>{busy ? "Creating…" : "Continue"} <span className="arrow" aria-hidden>→</span></button>
        </section>
      )}
    </div>
  );
}
