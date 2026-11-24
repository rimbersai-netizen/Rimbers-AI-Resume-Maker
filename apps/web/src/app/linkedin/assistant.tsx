"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AiJobInput } from "@gars/ai-engine";
import { Notice, useAiJob, Violations, Working } from "../profile/ai-assistant";
import { saveLinkedInDraft } from "./actions";

type Tab = "profile" | "headline" | "about" | "skills";
const TONES = ["professional", "confident", "friendly"] as const;
const LIMITS = { headline: 220, about: 2600 };

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (key: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1800); } catch { setCopied("error"); }
  };
  return { copied, copy };
}

function Generator(p: { kind: "linkedin_headline" | "linkedin_about"; masterProfileId: string; locale: string; onUse: (text: string) => void; disabled: boolean }) {
  const { phase, start, reset } = useAiJob(async () => true);
  const [tone, setTone] = useState<(typeof TONES)[number]>("professional");
  const [role, setRole] = useState("");
  const [text, setText] = useState("");
  useEffect(() => {
    if (phase.kind !== "ready") return;
    if (phase.output.kind === "linkedin_headline") setText(phase.output.headline);
    if (phase.output.kind === "linkedin_about") setText(phase.output.about);
  }, [phase]);
  const go = () => start(p.kind === "linkedin_headline"
    ? { kind: "linkedin_headline", masterProfileId: p.masterProfileId, locale: p.locale as AiJobInput["locale"], tone, targetRole: role || undefined }
    : { kind: "linkedin_about", masterProfileId: p.masterProfileId, locale: p.locale as AiJobInput["locale"], tone });
  const limit = p.kind === "linkedin_headline" ? LIMITS.headline : LIMITS.about;
  return (
    <div className="ai-panel">
      <div className="ai-controls">
        <label>Tone<select value={tone} onChange={(e) => setTone(e.target.value as typeof tone)}>{TONES.map((t) => <option key={t} value={t}>{t[0]!.toUpperCase() + t.slice(1)}</option>)}</select></label>
        {p.kind === "linkedin_headline" && <label>Target role (optional)<input type="text" maxLength={120} value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Engineering Manager" /></label>}
      </div>
      {phase.kind === "idle" && <button type="button" className="btn small" disabled={p.disabled} onClick={go}>✨ Generate with AI</button>}
      {phase.kind === "working" && <Working since={phase.since} />}
      {phase.kind === "ready" && (
        <>
          <label className="ai-label" htmlFor={`${p.kind}-sugg`}>AI suggestion <span className="muted small">(edit freely)</span></label>
          <textarea id={`${p.kind}-sugg`} rows={p.kind === "linkedin_headline" ? 2 : 10} maxLength={limit} value={text} onChange={(e) => setText(e.target.value)} />
          <p className="muted small">{text.length.toLocaleString()} / {limit.toLocaleString()}</p>
          <Violations output={phase.output} />
          <Notice />
          <div className="row">
            <button type="button" className="btn small" disabled={!text.trim()} onClick={() => { p.onUse(text.trim()); reset(); }}>Use this</button>
            <button type="button" className="btn secondary small" onClick={go}>Regenerate</button>
            <button type="button" className="link" onClick={reset}>Discard</button>
          </div>
        </>
      )}
      {phase.kind === "error" && <div className="alert error" role="alert">{phase.message}{phase.upgrade && <> <Link href="/account">See plans</Link></>} <button type="button" className="link" onClick={reset}>Close</button></div>}
    </div>
  );
}

export function LinkedInAssistant(p: {
  masterProfileId: string; locale: string; saved: { headline?: string; about?: string };
  person: { name: string; title?: string; city?: string; linkedin?: string; current?: string }; skills: string[]; profileReady: boolean;
}) {
  const [tab, setTab] = useState<Tab>("profile");
  const [headline, setHeadline] = useState(p.saved.headline ?? "");
  const [about, setAbout] = useState(p.saved.about ?? "");
  const [top, setTop] = useState<string[]>(p.skills.slice(0, 5));
  const [status, setStatus] = useState("");
  const { copied, copy } = useCopy();
  const linkedInUrl = p.person.linkedin && /^https:\/\/([a-z]+\.)?linkedin\.com\//i.test(p.person.linkedin) ? p.person.linkedin : "https://www.linkedin.com/";

  const save = async (next: { headline?: string; about?: string }) => {
    setStatus("Saving…");
    const r = await saveLinkedInDraft(p.masterProfileId, { headline: next.headline ?? headline, about: next.about ?? about });
    setStatus(r.ok ? "Saved" : r.message ?? "Could not save");
  };
  const checks = [
    { ok: headline.trim().length >= 20, label: "Headline that names your role and key skills" },
    { ok: about.trim().length >= 400, label: "About section of at least a few short paragraphs" },
    { ok: p.skills.length >= 5, label: "At least 5 skills (pin your top 5)" },
    { ok: Boolean(p.person.city), label: "Location set" },
  ];

  return (
    <div className="builder">
      <header className="builder-head">
        <Link href="/dashboard" className="muted">← Dashboard</Link>
        <h1>LinkedIn assistant</h1>
        <p className="save-status" role="status" aria-live="polite">{status}</p>
      </header>
      {!p.profileReady && <div className="alert error"><Link href="/profile">Complete your profile</Link> first — LinkedIn text is written only from your real experience.</div>}
      <div className="seg li-tabs" role="tablist" aria-label="LinkedIn sections">
        {(["profile", "headline", "about", "skills"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t[0]!.toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      <section className="card wide" role="tabpanel">
        {tab === "profile" && (
          <>
            <div className="li-card">
              <div className="li-avatar" aria-hidden>{p.person.name.slice(0, 1)}</div>
              <div>
                <strong>{p.person.name || "Your name"}</strong>
                <p className="li-headline">{headline || p.person.title || "Add a headline"}</p>
                <p className="muted small">{[p.person.current, p.person.city].filter(Boolean).join(" · ")}</p>
              </div>
            </div>
            <h2>Checklist</h2>
            <ul className="review-list">{checks.map((c) => <li key={c.label}><span className={c.ok ? "ok" : "todo"}>{c.ok ? "✓" : "•"}</span>{c.label}</li>)}</ul>
            <a className="btn" href={linkedInUrl} target="_blank" rel="noopener noreferrer">Open LinkedIn ↗</a>
            <p className="muted small">We never connect to or post on your LinkedIn account — copy the text and paste it yourself.</p>
          </>
        )}

        {tab === "headline" && (
          <>
            <label htmlFor="headline">LinkedIn headline</label>
            <textarea id="headline" rows={2} maxLength={LIMITS.headline} value={headline} onChange={(e) => setHeadline(e.target.value)} />
            <p className="muted small">{headline.length} / {LIMITS.headline}</p>
            <div className="row">
              <button type="button" className="btn secondary small" disabled={!headline} onClick={() => copy("headline", headline)}>{copied === "headline" ? "Copied ✓" : "Copy"}</button>
              <button type="button" className="btn small" onClick={() => save({ headline })}>Save</button>
            </div>
            <Generator kind="linkedin_headline" masterProfileId={p.masterProfileId} locale={p.locale} disabled={!p.profileReady} onUse={(t) => { setHeadline(t); void save({ headline: t }); }} />
          </>
        )}

        {tab === "about" && (
          <>
            <label htmlFor="about">About</label>
            <textarea id="about" rows={12} maxLength={LIMITS.about} value={about} onChange={(e) => setAbout(e.target.value)} />
            <p className="muted small">{about.length.toLocaleString()} / {LIMITS.about.toLocaleString()}</p>
            <div className="row">
              <button type="button" className="btn secondary small" disabled={!about} onClick={() => copy("about", about)}>{copied === "about" ? "Copied ✓" : "Copy All"}</button>
              <button type="button" className="btn small" onClick={() => save({ about })}>Save</button>
            </div>
            <Generator kind="linkedin_about" masterProfileId={p.masterProfileId} locale={p.locale} disabled={!p.profileReady} onUse={(t) => { setAbout(t); void save({ about: t }); }} />
          </>
        )}

        {tab === "skills" && (
          <>
            <p className="muted">Choose up to 5 skills to pin at the top of your LinkedIn profile.</p>
            <ul className="chips" aria-label="Your skills">
              {p.skills.map((s) => {
                const on = top.includes(s);
                return (
                  <li key={s}>
                    <button type="button" className={`chip ${on ? "ok" : ""}`} aria-pressed={on} disabled={!on && top.length >= 5}
                      onClick={() => setTop(on ? top.filter((x) => x !== s) : [...top, s])}>{on ? "★ " : ""}{s}</button>
                  </li>
                );
              })}
            </ul>
            {p.skills.length === 0 && <p className="empty">Add skills in your <Link href="/profile">profile</Link> first.</p>}
            <div className="row">
              <button type="button" className="btn secondary small" disabled={!top.length} onClick={() => copy("top", top.join(", "))}>{copied === "top" ? "Copied ✓" : "Copy top skills"}</button>
              <button type="button" className="btn secondary small" disabled={!p.skills.length} onClick={() => copy("all", p.skills.join(", "))}>{copied === "all" ? "Copied ✓" : "Copy all skills"}</button>
            </div>
          </>
        )}
        {copied === "error" && <p className="field-error" role="alert">Copy failed — select the text and copy it manually.</p>}
      </section>
    </div>
  );
}
