"use client";

import { useState } from "react";
import Link from "next/link";
import type { AiJobInput } from "@gars/ai-engine";
import { Notice, Working, useAiJob } from "../profile/ai-assistant";

const CATEGORY: Record<string, string> = { behavioral: "Behavioral", technical: "Technical", role: "Role", situational: "Situational", motivation: "Motivation" };

export function InterviewPrep(p: { masterProfileId: string; locale: string; profileReady: boolean; initialRole: string; initialCompany: string }) {
  const { phase, start, reset } = useAiJob(async () => true);
  const [role, setRole] = useState(p.initialRole);
  const [company, setCompany] = useState(p.initialCompany);
  const [jd, setJd] = useState("");
  const [error, setError] = useState("");
  const busy = phase.kind === "working";

  const go = () => {
    if (role.trim().length < 2) return setError("Enter the role you are interviewing for.");
    if (!p.profileReady) return setError("Add your name and experience in your profile first — questions are based on it.");
    setError("");
    void start({
      kind: "interview_prep", masterProfileId: p.masterProfileId, locale: p.locale, jobTitle: role.trim(), count: 8,
      ...(company.trim() ? { company: company.trim() } : {}), ...(jd.trim() ? { jobDescription: jd.trim() } : {}),
    } as AiJobInput);
  };

  return (
    <div className="builder">
      <header className="builder-head">
        <Link href="/dashboard" className="muted">← Dashboard</Link>
        <h1>Interview Prep <span className="pro-badge">PRO</span></h1>
        <p className="muted">Practise the questions you are most likely to be asked — with talking points from your own experience.</p>
      </header>

      <section className="card wide" aria-labelledby="ip-form">
        <h2 id="ip-form">The interview</h2>
        <label>Role you are interviewing for *<input type="text" value={role} maxLength={200} onChange={(e) => setRole(e.target.value)} /></label>
        <label>Company (optional)<input type="text" value={company} maxLength={200} onChange={(e) => setCompany(e.target.value)} /></label>
        <label>Job description (optional — makes questions more specific)<textarea rows={5} value={jd} maxLength={20000} onChange={(e) => setJd(e.target.value)} /></label>
        {error && <div className="alert error" role="alert">{error}</div>}
        {!p.profileReady && <div className="alert error" role="status">Your profile is empty. <Link href="/profile">Complete your profile</Link> first.</div>}
        <button type="button" className="btn" onClick={go} disabled={busy}>{busy ? "Generating…" : phase.kind === "ready" ? "Generate new questions" : "✨ Generate questions"}</button>
        {phase.kind === "working" && <Working since={phase.since} />}
        {phase.kind === "error" && (
          <div className="alert error" role="alert">{phase.message}{phase.upgrade && <> <Link href="/pricing">See plans</Link></>}</div>
        )}
      </section>

      {phase.kind === "ready" && phase.output.kind === "interview_prep" && (
        <section className="card wide" aria-labelledby="ip-res">
          <h2 id="ip-res">{phase.output.questions.length} questions</h2>
          {phase.output.gaps.length > 0 && (
            <div className="alert error" role="note"><strong>Be ready to discuss:</strong> the job mentions {phase.output.gaps.join(", ")} — not in your profile. Prepare an honest answer about your experience with these.</div>
          )}
          {phase.output.questions.map((q, i) => (
            <details key={i} className="iq">
              <summary><span className="chip">{CATEGORY[q.category] ?? "General"}</span> <strong>{q.question}</strong></summary>
              <h3>How to answer</h3>
              <p className="muted">{q.tip}</p>
              <h3>From your profile</h3>
              {q.talkingPoints.length ? <ul>{q.talkingPoints.map((t, j) => <li key={j}>✓ {t}</li>)}</ul> : <p className="muted">Nothing in your profile matches this one — answer from your own experience.</p>}
            </details>
          ))}
          <button type="button" className="btn secondary" onClick={reset}>Clear</button>
          <Notice />
        </section>
      )}
    </div>
  );
}
