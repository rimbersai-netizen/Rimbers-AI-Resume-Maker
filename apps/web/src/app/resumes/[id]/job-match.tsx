"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { analyzeResume, compareAnalyses, type AnalysisResult } from "@gars/ats-engine";
import type { ResumeDocument } from "@gars/resume-schema";
import type { TemplateSpec } from "@gars/template-engine";
import type { AiJobInput } from "@gars/ai-engine";
import { Notice, useAiJob, Violations, Working } from "../../profile/ai-assistant";
import { saveAtsAnalysis } from "../ats-actions";

const BAND: Record<AnalysisResult["band"], string> = { strong: "Strong", good: "Good", fair: "Fair", needs_work: "Needs work" };

function ScoreRing({ score, label }: { score: number; label: string }) {
  const r = 34, c = 2 * Math.PI * r;
  const color = score >= 80 ? "var(--success)" : score >= 50 ? "#D08A00" : "var(--danger)";
  return (
    <svg width="92" height="92" viewBox="0 0 92 92" role="img" aria-label={`${label}: ${score} out of 100`}>
      <circle cx="46" cy="46" r={r} fill="none" stroke="var(--border)" strokeWidth="8" />
      <circle cx="46" cy="46" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${(score / 100) * c} ${c}`} transform="rotate(-90 46 46)" />
      <text x="46" y="50" textAnchor="middle" fontSize="20" fontWeight="700" fill="var(--text-primary)">{score}</text>
    </svg>
  );
}

export function JobMatchPanel(p: {
  resumeId: string; masterProfileId: string; locale: string; doc: ResumeDocument; template: TemplateSpec;
  summaryOverride?: string; onUseSummary: (text: string | undefined) => void;
}) {
  const [title, setTitle] = useState("");
  const [jd, setJd] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [before, setBefore] = useState<AnalysisResult | null>(null);
  const [text, setText] = useState("");
  const { phase, start, reset } = useAiJob(async () => true); // tailoring reads the saved master profile

  const analyze = (doc = p.doc) => analyzeResume({ profile: doc.profile, template: p.template.ats, jobDescription: jd, hiddenItemIds: doc.hiddenItemIds });
  const run = () => {
    const r = analyze();
    setBefore(null);
    setResult(r);
    void saveAtsAnalysis(p.resumeId, { title, body: jd }, r);
  };
  const delta = useMemo(() => (before && result ? compareAnalyses(before, result) : null), [before, result]);
  const km = result?.keywordMatch;
  const tailored = phase.kind === "ready" && phase.output.kind === "tailored_summary" ? phase.output : null;

  return (
    <section aria-labelledby="jm-title">
      <h2 id="jm-title">Job match &amp; ATS check</h2>
      <label htmlFor="jd-title">Job title (optional)</label>
      <input id="jd-title" type="text" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Senior Software Engineer" />
      <label htmlFor="jd">Paste job description</label>
      <div className="field">
        <textarea id="jd" rows={6} value={jd} maxLength={20000} onChange={(e) => setJd(e.target.value)} placeholder="Paste the full job posting, including requirements." />
        <span className="counter">{jd.length.toLocaleString()} / 20,000</span>
      </div>
      <button type="button" className="btn" disabled={jd.trim().length < 30} onClick={run}>Analyze &amp; match</button>

      {result && (
        <div className="jm-result" aria-live="polite">
          <div className="jm-head">
            <ScoreRing score={result.overall} label="Estimated ATS score" />
            <div>
              <strong className="jm-band">{BAND[result.band]}</strong>
              {km && <p className="muted small">Job keyword match: {km.score}%</p>}
              {delta && <p className={`small ${delta.overallDelta >= 0 ? "pos" : "neg"}`}>{delta.overallDelta >= 0 ? "+" : ""}{delta.overallDelta} after your change</p>}
            </div>
          </div>
          <ul className="jm-cats">
            {result.categories.map((c) => {
              const d = delta?.categories.find((x) => x.id === c.id)?.delta;
              return (
                <li key={c.id}>
                  <details>
                    <summary><span>{c.label}</span><span className="jm-score">{c.score}%{d ? <em className={d > 0 ? "pos" : "neg"}> {d > 0 ? "+" : ""}{d}</em> : null}</span></summary>
                    {c.findings.length ? <ul className="notes">{c.findings.map((f) => <li key={f.id}><span className={`sev ${f.severity}`}>{f.severity}</span> {f.message}{f.suggestion ? <span className="muted"> — {f.suggestion}</span> : null}</li>)}</ul>
                      : <p className="muted small">No issues found.</p>}
                  </details>
                </li>
              );
            })}
          </ul>
          {km && (
            <>
              {km.matched.length > 0 && <><p className="ai-label">Matched</p><ul className="chips">{km.matched.map((k) => <li key={k.term} className="chip ok">✓ {k.term}</li>)}</ul></>}
              {km.missingRequired.length > 0 && <><p className="ai-label">Required by the job, not found in your resume</p>
                <ul className="chips">{km.missingRequired.map((k) => <li key={k.term} className="chip warn">{k.term}</li>)}</ul>
                <p className="muted small">Add these to your <Link href="/profile">profile</Link> only if you genuinely have them.</p></>}
            </>
          )}
          <p className="muted small disclaimer">{result.disclaimer}</p>

          <h3>Tailor this resume</h3>
          {p.summaryOverride && phase.kind === "idle" && (
            <div className="alert ok small">This resume uses a job-tailored summary. <button type="button" className="link" onClick={() => p.onUseSummary(undefined)}>Reset to profile summary</button></div>
          )}
          {phase.kind === "idle" && (
            <button type="button" className="btn secondary" onClick={() => start({ kind: "tailor_resume", masterProfileId: p.masterProfileId, jobDescription: jd, tone: "professional", locale: p.locale as AiJobInput["locale"], targetRole: title || undefined })}>
              ✨ Tailor summary for this job
            </button>
          )}
          {phase.kind === "working" && <Working since={phase.since} />}
          {tailored && (
            <div className="ai-panel">
              <label htmlFor="tailored" className="ai-label">Tailored summary <span className="muted small">(for this resume only — your profile stays unchanged)</span></label>
              <textarea id="tailored" rows={5} maxLength={1200} value={text || tailored.summary} onChange={(e) => setText(e.target.value)} />
              <Violations output={tailored} />
              {tailored.missingRequired.length > 0 && <p className="muted small">Not claimed because they aren&apos;t in your profile: {tailored.missingRequired.join(", ")}.</p>}
              <Notice />
              <div className="row">
                <button type="button" className="btn small" onClick={() => {
                  const chosen = (text || tailored.summary).trim();
                  const prev = result;
                  p.onUseSummary(chosen);
                  setBefore(prev);
                  setResult(analyze({ ...p.doc, profile: { ...p.doc.profile, summary: chosen } }));
                  setText(""); reset();
                }}>Use in this resume</button>
                <button type="button" className="link" onClick={() => { setText(""); reset(); }}>Discard</button>
              </div>
            </div>
          )}
          {phase.kind === "error" && <div className="alert error" role="alert">{phase.message}{phase.upgrade && <> <Link href="/account">See plans</Link></>} <button type="button" className="link" onClick={reset}>Close</button></div>}
        </div>
      )}
    </section>
  );
}
