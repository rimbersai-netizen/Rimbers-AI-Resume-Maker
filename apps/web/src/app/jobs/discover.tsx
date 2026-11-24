"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ScoredJob } from "@/lib/services/jobs";
import { loadMoreJobs, setState, undoState } from "./actions";
import { ago, ScoreBar } from "./bits";

type Last = { job: ScoredJob; id: string; verb: string };

/** Swipe-style discovery: drag the card, use the buttons, or the keyboard (← pass, S save, → add to applications). */
export function Discover({ initial, total }: { initial: ScoredJob[]; total: number }) {
  const [queue, setQueue] = useState(initial);
  const [remaining, setRemaining] = useState(Math.max(0, total - initial.length));
  const [last, setLast] = useState<Last | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [drag, setDrag] = useState(0);
  const start = useRef<number | null>(null);
  const loaded = useRef(initial.length);
  const job = queue[0];

  useEffect(() => { setOpen(false); }, [job?.key]);

  const refill = useCallback(async (have: number) => {
    if (remaining <= 0) return;
    const more = await loadMoreJobs(have); // acted-on jobs are excluded server-side, so the next page starts after the cards still queued
    if (more) { setQueue((q) => [...q, ...more.jobs.filter((j) => !q.some((x) => x.key === j.key))]); setRemaining(Math.max(0, more.total - more.jobs.length)); }
  }, [remaining]);

  const act = useCallback(async (state: "passed" | "saved" | "ready", verb: string) => {
    if (!job || busy) return;
    setBusy(true); setMsg(null);
    const r = await setState(job.key, state);
    setBusy(false);
    if (!r.ok) return setMsg(r.message);
    setLast({ job, id: r.value.item.id, verb });
    setQueue((q) => q.slice(1));
    loaded.current += 1;
    if (queue.length <= 5) void refill(queue.length - 1);
  }, [job, busy, queue.length, refill]);

  const undo = async () => {
    if (!last || busy) return;
    setBusy(true);
    const ok = await undoState(last.id);
    setBusy(false);
    if (!ok) return setMsg("Could not undo.");
    setQueue((q) => [last.job, ...q]);
    setLast(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea,select,button,a")) return;
      if (e.key === "ArrowLeft") void act("passed", "Passed");
      else if (e.key === "ArrowRight") void act("ready", "Added to applications");
      else if (e.key.toLowerCase() === "s") void act("saved", "Saved");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [act]);

  if (!job) {
    return (
      <div className="empty" style={{ marginTop: 16 }}>
        <p><strong>You’re all caught up.</strong></p>
        <p className="muted">No more listings match your preferences right now. Widen your <Link href="/jobs/preferences">preferences</Link> or check back later.</p>
        {last && <button type="button" className="link" onClick={undo}>↶ Undo last</button>}
      </div>
    );
  }

  const text = job.description;
  return (
    <div className="jobs-stack">
      <article
        className="jobs-card" aria-label={`${job.title} at ${job.company}`}
        style={{ transform: drag ? `translateX(${drag}px) rotate(${drag / 40}deg)` : undefined, transition: drag ? "none" : "transform .2s" }}
        onPointerDown={(e) => { if ((e.target as HTMLElement).closest("a,button,summary")) return; start.current = e.clientX; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { if (start.current !== null) setDrag(e.clientX - start.current); }}
        onPointerUp={() => { const d = drag; start.current = null; setDrag(0); if (d > 110) void act("ready", "Added to applications"); else if (d < -110) void act("passed", "Passed"); }}
        onPointerCancel={() => { start.current = null; setDrag(0); }}
      >
        {drag > 40 && <span className="jobs-stamp apply">ADD</span>}
        {drag < -40 && <span className="jobs-stamp pass">PASS</span>}
        <header className="jobs-card-head">
          {job.logo ? <img src={job.logo} alt="" width={44} height={44} className="jobs-logo" /> : <span className="jobs-logo ph" aria-hidden>{job.company.charAt(0)}</span>}
          <div>
            <div className="jobs-company">{job.company}</div>
            <h2>{job.title}</h2>
            <div className="muted small">{[job.salaryText, job.location, job.jobType, ago(job.postedAt)].filter(Boolean).join(" · ")}</div>
          </div>
        </header>
        <ScoreBar score={job.match.score} label={job.match.label} />
        {job.match.profileYears > 0 || job.match.requiredYears ? (
          <p className="muted small">{job.match.requiredYears ? `Asks for ${job.match.requiredYears}+ years` : "Years not stated"} · you have {job.match.profileYears} on your profile</p>
        ) : null}
        <h3 className="jobs-h3">On your resume</h3>
        <div className="chips-row">{job.match.matched.length ? job.match.matched.map((s) => <span key={s.skill} className="chip ok">✓ {s.label}</span>) : <span className="muted small">No listed skills found on your profile.</span>}</div>
        {job.match.missing.length > 0 && (<><h3 className="jobs-h3">To grow</h3><div className="chips-row">{job.match.missing.map((s) => <span key={s.skill} className="chip">{s.label}{s.required ? " *" : ""}</span>)}</div></>)}
        <details className="jobs-desc" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
          <summary>{open ? "Hide details" : "Read the role"}</summary>
          <p style={{ whiteSpace: "pre-wrap" }}>{text}</p>
        </details>
        <footer className="muted small">via {job.source === "remotive" ? "Remotive" : "Arbeitnow"} · <a href={job.url} target="_blank" rel="noopener noreferrer">View original posting ↗</a></footer>
      </article>

      <div className="jobs-actions" role="group" aria-label="Job actions">
        <button type="button" className="round" onClick={undo} disabled={!last || busy} aria-label="Undo last action" title="Undo">↶</button>
        <button type="button" className="round pass" onClick={() => act("passed", "Passed")} disabled={busy} aria-label="Pass (left arrow)" title="Pass ←">✕</button>
        <button type="button" className="round" onClick={() => act("saved", "Saved")} disabled={busy} aria-label="Save for later (S)" title="Save (S)">🔖</button>
        <button type="button" className="round go" onClick={() => act("ready", "Added to applications")} disabled={busy} aria-label="Add to my applications (right arrow)" title="Add to applications →">♥</button>
      </div>
      <p className="muted small center" role="status" aria-live="polite">{msg ?? (last ? `${last.verb}: ${last.job.title}` : "Drag the card, use the buttons, or press ← S →")}</p>
    </div>
  );
}
