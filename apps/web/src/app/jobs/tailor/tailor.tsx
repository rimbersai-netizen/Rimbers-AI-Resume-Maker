"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { SkillHit, TailorPlan } from "@gars/ats-engine";
import type { Job, ScoredJob } from "@/lib/services/jobs";
import { getAiJob } from "../../profile/ai-actions";
import { applySelected, finishSummary } from "../actions";
import { ScoreBar } from "../bits";

type Phase = { k: "idle" } | { k: "busy"; text: string } | { k: "done"; resumeId: string; added: string[]; summary?: string; note?: string } | { k: "error"; message: string };

export function Tailor({ jobKey, job, plan, match }: { jobKey: string; job: Job; plan: TailorPlan; match: ScoredJob["match"] }) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(plan.optimizations.map((s) => s.skill)));
  const [summary, setSummary] = useState(true);
  const [phase, setPhase] = useState<Phase>({ k: "idle" });
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const run = async () => {
    setPhase({ k: "busy", text: "Updating your profile and creating the resume…" });
    const r = await applySelected({ key: jobKey, addSkills: [...picked], tailorSummary: summary });
    if (!r.ok) return setPhase({ k: "error", message: r.message });
    const { resumeId, aiJobId, added, aiMessage } = r.value;
    if (!aiJobId) return setPhase({ k: "done", resumeId, added, note: aiMessage });
    setPhase({ k: "busy", text: "Writing a role-focused summary from your real experience (this can take a minute)…" });
    const t0 = Date.now();
    while (alive.current && Date.now() - t0 < 180_000) {
      await new Promise((res) => setTimeout(res, 1500));
      const s = await getAiJob(aiJobId).catch(() => null);
      if (!s) break;
      if (s.status === "succeeded") {
        const f = await finishSummary(resumeId, aiJobId);
        return setPhase({ k: "done", resumeId, added, summary: f.ok ? f.value.summary : undefined, note: f.ok ? undefined : f.message });
      }
      if (s.status === "failed" || s.status === "cancelled") return setPhase({ k: "done", resumeId, added, note: `Resume created, but no summary was written: ${s.message}` });
    }
    setPhase({ k: "done", resumeId, added, note: "Resume created. The summary is taking too long — you can write it from the editor." });
  };

  const Row = ({ s, kind }: { s: SkillHit; kind: "opt" | "gap" }) => (
    <li>
      <label className="jobs-check">
        <input type="checkbox" checked={picked.has(s.skill)} onChange={() => toggle(s.skill)} />
        <span><strong>{s.label}</strong><small className="muted">{kind === "opt" ? " — already in your experience; add it to your skills list" : " — only tick if you really have this skill"}</small></span>
        <span className={`tag ${s.required ? "req" : "pref"}`}>{s.required ? "Required" : "Preferred"}</span>
      </label>
    </li>
  );

  return (
    <>
      <h1>Tailor for {job.title}</h1>
      <p className="muted">{job.company} · {job.location}</p>
      <ScoreBar score={match.score} label={match.label} />
      <section className="card wide" aria-label="Job tailoring" style={{ marginTop: 16 }}>
        <p className="muted small">We compare the posting with your saved profile. Nothing is added unless you tick it, and the AI is only allowed to use facts already on your profile.</p>
        <h2 className="jobs-h2 ok">Strengths <span className="badge">{plan.strengths.length}</span></h2>
        {plan.strengths.length ? <ul className="jobs-checks">{plan.strengths.map((s) => <li key={s.skill} className="jobs-check static"><span>✓ <strong>{s.label}</strong> <small className="muted">already in your resume — no changes needed</small></span><span className={`tag ${s.required ? "req" : "pref"}`}>{s.required ? "Required" : "Preferred"}</span></li>)}</ul> : <p className="muted small">None of this job’s skills are in your skills list yet.</p>}
        <h2 className="jobs-h2">Optimizations <span className="badge">{plan.optimizations.length}</span></h2>
        {plan.optimizations.length ? <ul className="jobs-checks">{plan.optimizations.map((s) => <Row key={s.skill} s={s} kind="opt" />)}</ul> : <p className="muted small">Nothing to surface.</p>}
        <h2 className="jobs-h2 bad">Gaps <span className="badge">{plan.gaps.length}</span></h2>
        {plan.gaps.length ? <ul className="jobs-checks">{plan.gaps.map((s) => <Row key={s.skill} s={s} kind="gap" />)}</ul> : <p className="muted small">No gaps found.</p>}
        <label className="jobs-check" style={{ marginTop: 12 }}>
          <input type="checkbox" checked={summary} onChange={(e) => setSummary(e.target.checked)} />
          <span><strong>Role-focused summary</strong><small className="muted"> — the AI rewrites your summary for this role, then fact-checks it against your profile</small></span>
        </label>
        {phase.k === "error" && <p className="alert error" role="alert">{phase.message}</p>}
        {phase.k === "busy" && <p className="alert ok" role="status"><span className="spinner" aria-hidden /> {phase.text}</p>}
        {phase.k === "done" && (
          <div className="alert ok" role="status">
            <strong>Your tailored resume is ready.</strong>
            {phase.added.length > 0 && <div className="small">Added to your skills: {phase.added.join(", ")}</div>}
            {phase.summary && <div className="small">Summary: {phase.summary}</div>}
            {phase.note && <div className="small">{phase.note}</div>}
            <div className="row"><Link className="btn" href={`/resumes/${phase.resumeId}`}>Open resume</Link><Link href="/jobs/applied">Back to applications</Link></div>
          </div>
        )}
        {phase.k !== "done" && <button type="button" className="btn" disabled={phase.k === "busy"} onClick={run}>{phase.k === "busy" ? "Working…" : `Apply selected${picked.size ? ` (${picked.size})` : ""}`}</button>}
      </section>
    </>
  );
}
