"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AiJobInput } from "@gars/ai-engine";
import { localeLabel, RESUME_LOCALES } from "@/lib/resume-settings";
import { Notice, useAiJob, Violations, Working } from "../../profile/ai-assistant";
import { createCoverLetter } from "../actions";

const TONES = ["professional", "confident", "friendly", "formal", "concise"] as const;

export function NewLetter(p: { masterProfileId: string; profileReady: boolean; resumes: { id: string; title: string; locale: string; page_size: string }[]; appLocale: string }) {
  const router = useRouter();
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [keyPoints, setKeyPoints] = useState("");
  const [jd, setJd] = useState("");
  const [tone, setTone] = useState<(typeof TONES)[number]>("professional");
  const [resumeId, setResumeId] = useState(p.resumes[0]?.id ?? "");
  const linked = p.resumes.find((r) => r.id === resumeId);
  const [locale, setLocale] = useState(linked?.locale ?? p.appLocale);
  const [letter, setLetter] = useState("");
  const [error, setError] = useState("");
  const { phase, start, reset } = useAiJob(async () => true);
  useEffect(() => { if (phase.kind === "ready" && phase.output.kind === "cover_letter") setLetter(phase.output.letter); }, [phase]);

  const save = async (body: string) => {
    const r = await createCoverLetter({ title: jobTitle || "Cover letter", body, locale: locale as never, pageSize: (linked?.page_size as "A4" | "Letter") ?? "A4",
      jobTitle: jobTitle || undefined, company: company || undefined, resumeId: resumeId || undefined });
    if (r.ok) router.push(`/cover-letters/${r.id}`); else setError(r.message);
  };
  const generate = () => start({ kind: "cover_letter", masterProfileId: p.masterProfileId, tone, locale: locale as AiJobInput["locale"],
    jobTitle, company: company || undefined, keyPoints: keyPoints || undefined, jobDescription: jd || undefined });
  const ready = phase.kind === "ready" && phase.output.kind === "cover_letter" ? phase.output : null;

  return (
    <div className="builder">
      <header className="builder-head"><Link href="/cover-letters" className="muted">← Cover letters</Link><h1>Cover letter generator</h1></header>
      {!p.profileReady && <div className="alert error"><Link href="/profile">Complete your profile</Link> first — letters are written only from your real experience.</div>}
      <section className="card wide">
        <div className="grid2">
          <div className="field"><label htmlFor="jt">Job title *</label><input id="jt" type="text" maxLength={200} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Software Engineer" /></div>
          <div className="field"><label htmlFor="co">Company (optional)</label><input id="co" type="text" maxLength={200} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Tech Solutions Co." /></div>
          <div className="field span2"><label htmlFor="kp">Key points (optional)</label><input id="kp" type="text" maxLength={1000} value={keyPoints} onChange={(e) => setKeyPoints(e.target.value)} placeholder="React, Node.js, team leadership, available from March" /></div>
        </div>
        <details><summary>Paste the job description (optional, improves matching)</summary>
          <textarea aria-label="Job description" rows={5} maxLength={20000} value={jd} onChange={(e) => setJd(e.target.value)} />
        </details>
        <div className="grid3">
          <div className="field"><label htmlFor="tone">Tone</label><select id="tone" value={tone} onChange={(e) => setTone(e.target.value as typeof tone)}>{TONES.map((t) => <option key={t} value={t}>{t[0]!.toUpperCase() + t.slice(1)}</option>)}</select></div>
          <div className="field"><label htmlFor="lang">Letter language</label><select id="lang" value={locale} onChange={(e) => setLocale(e.target.value)}>{RESUME_LOCALES.map((l) => <option key={l} value={l}>{localeLabel(l)}</option>)}</select></div>
          <div className="field"><label htmlFor="res">Match style of resume</label><select id="res" value={resumeId} onChange={(e) => setResumeId(e.target.value)}><option value="">None</option>{p.resumes.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}</select></div>
        </div>
        {phase.kind === "idle" && (
          <div className="row">
            <button type="button" className="btn" disabled={jobTitle.trim().length < 2 || !p.profileReady} onClick={generate}>✨ Generate with AI</button>
            <button type="button" className="link" disabled={jobTitle.trim().length < 2} onClick={() => save(`Dear Hiring Manager,\n\n\n\nSincerely,\n`)}>Write it myself</button>
          </div>
        )}
        {phase.kind === "working" && <Working since={phase.since} />}
        {ready && (
          <div className="ai-panel">
            <label htmlFor="letter" className="ai-label">Cover letter (AI generated — edit freely)</label>
            <textarea id="letter" rows={14} maxLength={20000} value={letter} onChange={(e) => setLetter(e.target.value)} />
            <Violations output={ready} />
            {ready.missingRequired.length > 0 && <p className="muted small">Not claimed because they aren&apos;t in your profile: {ready.missingRequired.join(", ")}.</p>}
            <Notice />
            <div className="row">
              <button type="button" className="btn small" disabled={!letter.trim()} onClick={() => save(letter)}>Save letter</button>
              <button type="button" className="btn secondary small" onClick={generate}>Regenerate</button>
              <button type="button" className="link" onClick={() => { setLetter(""); reset(); }}>Discard</button>
            </div>
          </div>
        )}
        {phase.kind === "error" && <div className="alert error" role="alert">{phase.message}{phase.upgrade && <> <Link href="/account">See plans</Link></>} <button type="button" className="link" onClick={reset}>Close</button></div>}
        {error && <div className="alert error" role="alert">{error}</div>}
      </section>
    </div>
  );
}
