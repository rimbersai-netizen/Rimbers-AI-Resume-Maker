"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { AiJobInput, AiJobOutput } from "@gars/ai-engine";
import { cancelAiJob, getAiJob, requestAiSuggestion } from "./ai-actions";

type Phase = { kind: "idle" } | { kind: "working"; jobId: string; since: number } | { kind: "ready"; output: AiJobOutput } | { kind: "error"; message: string; upgrade?: boolean; canRetry?: boolean };
const TONES = ["professional", "confident", "friendly", "formal", "concise"] as const;
const MAX_WAIT_MS = 4 * 60_000;

/** Queue → poll → result, with cancel on unmount/discard. `prepare` saves the profile first (the worker reads saved data). */
function useAiJob(prepare: () => Promise<boolean>) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const job = useRef<string | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); if (job.current) void cancelAiJob(job.current); }, []);

  const poll = (jobId: string, since: number) => {
    timer.current = setTimeout(async () => {
      const s = await getAiJob(jobId).catch(() => null);
      if (!s) return setPhase({ kind: "error", message: "Lost track of the request. Please try again.", canRetry: true });
      if (s.status === "succeeded") { job.current = null; return setPhase({ kind: "ready", output: s.output }); }
      if (s.status === "failed" || s.status === "cancelled") { job.current = null; return setPhase({ kind: "error", message: s.message, canRetry: s.canRetry }); }
      if (Date.now() - since > MAX_WAIT_MS) {
        void cancelAiJob(jobId); job.current = null;
        return setPhase({ kind: "error", message: "The AI writing assistant is temporarily unavailable. Your data is safe — you can keep editing and try again later.", canRetry: true });
      }
      poll(jobId, since);
    }, 1500);
  };

  const start = async (input: AiJobInput) => {
    if (!(await prepare())) return setPhase({ kind: "error", message: "Fix the highlighted profile fields first, then try again." });
    const r = await requestAiSuggestion(input);
    if (!r.ok) return setPhase({ kind: "error", message: r.message, upgrade: r.upgrade });
    job.current = r.jobId;
    const since = Date.now();
    setPhase({ kind: "working", jobId: r.jobId, since });
    poll(r.jobId, since);
  };
  const reset = () => { if (timer.current) clearTimeout(timer.current); if (job.current) void cancelAiJob(job.current); job.current = null; setPhase({ kind: "idle" }); };
  return { phase, start, reset };
}

function Violations({ output }: { output: AiJobOutput }) {
  const review = (output.violations as { kind: string; value: string; severity: string }[]).filter((v) => v.severity === "review");
  if (!review.length) return null;
  return (
    <div className="alert error small" role="note">
      Please confirm these are true before accepting: {review.map((v) => <mark key={v.value}>{v.value}</mark>).reduce<React.ReactNode[]>((a, x, i) => (i ? [...a, ", ", x] : [x]), [])}
    </div>
  );
}

function Working({ since }: { since: number }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, []);
  const s = Math.round((Date.now() - since) / 1000);
  return <p className="muted small" role="status" aria-live="polite"><span className="spinner" aria-hidden /> Writing with the on-device AI… {s}s (usually under a minute)</p>;
}

const Notice = () => <p className="muted small">AI can make mistakes. It only uses your profile — check every detail is accurate before accepting.</p>;

export function SummaryAssistant(p: { masterProfileId: string; locale: string; prepare: () => Promise<boolean>; onAccept: (text: string) => void }) {
  const { phase, start, reset } = useAiJob(p.prepare);
  const [tone, setTone] = useState<(typeof TONES)[number]>("professional");
  const [length, setLength] = useState<"short" | "medium" | "long">("medium");
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  useEffect(() => { if (phase.kind === "ready" && phase.output.kind === "summary") setText(phase.output.summary); }, [phase]);
  const go = () => start({ kind: "summary", masterProfileId: p.masterProfileId, tone, length, locale: p.locale as AiJobInput["locale"] });

  if (!open) return <button type="button" className="link ai-btn" onClick={() => setOpen(true)}>✨ Write with AI</button>;
  return (
    <section className="ai-panel" aria-label="AI writing assistant">
      <div className="ai-controls">
        <label>Writing tone<select value={tone} onChange={(e) => setTone(e.target.value as typeof tone)}>{TONES.map((t) => <option key={t} value={t}>{t[0]!.toUpperCase() + t.slice(1)}</option>)}</select></label>
        <label>Length<select value={length} onChange={(e) => setLength(e.target.value as typeof length)}><option value="short">Short</option><option value="medium">Medium</option><option value="long">Long</option></select></label>
      </div>
      {phase.kind === "idle" && <button type="button" className="btn" onClick={go}>✨ Generate with AI</button>}
      {phase.kind === "working" && <Working since={phase.since} />}
      {phase.kind === "ready" && (
        <>
          <label htmlFor="ai-summary" className="ai-label">AI suggestion <span className="muted small">(you can edit it)</span></label>
          <textarea id="ai-summary" rows={5} value={text} maxLength={1200} onChange={(e) => setText(e.target.value)} />
          <Violations output={phase.output} />
          <Notice />
          <div className="row">
            <button type="button" className="btn small" onClick={() => { p.onAccept(text.trim()); reset(); setOpen(false); }} disabled={!text.trim()}>Use this summary</button>
            <button type="button" className="btn secondary small" onClick={go}>Regenerate</button>
            <button type="button" className="link" onClick={() => { reset(); setOpen(false); }}>Discard</button>
          </div>
        </>
      )}
      {phase.kind === "error" && (
        <div className="alert error" role="alert">{phase.message}{phase.upgrade && <> <Link href="/account">See plans</Link></>}
          <div className="row">{phase.canRetry !== false && !phase.upgrade && <button type="button" className="btn secondary small" onClick={go}>Try again</button>}
            <button type="button" className="link" onClick={() => { reset(); setOpen(false); }}>Close</button></div>
        </div>
      )}
    </section>
  );
}

export function BulletsAssistant(p: { masterProfileId: string; experienceId: string; locale: string; prepare: () => Promise<boolean>; onAccept: (bullets: string[]) => void }) {
  const { phase, start, reset } = useAiJob(p.prepare);
  const [items, setItems] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => { if (phase.kind === "ready" && phase.output.kind === "achievement_bullets") setItems(phase.output.bullets); }, [phase]);
  const go = () => start({ kind: "achievement_bullets", masterProfileId: p.masterProfileId, experienceId: p.experienceId, tone: "professional", locale: p.locale as AiJobInput["locale"] });

  if (!open) return <button type="button" className="link ai-btn" onClick={() => { setOpen(true); void go(); }}>✨ Improve with AI</button>;
  return (
    <section className="ai-panel" aria-label="AI bullet suggestions">
      {phase.kind === "working" && <Working since={phase.since} />}
      {phase.kind === "ready" && (
        <>
          <p className="ai-label">Suggested bullets <span className="muted small">(edit or remove before accepting)</span></p>
          {items.map((b, i) => (
            <div className="bullet-row" key={i}>
              <span aria-hidden>•</span>
              <textarea aria-label={`Suggested bullet ${i + 1}`} rows={2} maxLength={600} value={b} onChange={(e) => setItems(items.map((x, j) => (j === i ? e.target.value : x)))} />
              <button type="button" className="icon" aria-label={`Remove suggested bullet ${i + 1}`} onClick={() => setItems(items.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          <Violations output={phase.output} />
          <Notice />
          <div className="row">
            <button type="button" className="btn small" disabled={!items.some((x) => x.trim())} onClick={() => { p.onAccept(items.map((x) => x.trim()).filter(Boolean)); reset(); setOpen(false); }}>Replace my bullets</button>
            <button type="button" className="btn secondary small" onClick={go}>Regenerate</button>
            <button type="button" className="link" onClick={() => { reset(); setOpen(false); }}>Discard</button>
          </div>
        </>
      )}
      {phase.kind === "error" && (
        <div className="alert error" role="alert">{phase.message}{phase.upgrade && <> <Link href="/account">See plans</Link></>}
          <div className="row">{phase.canRetry !== false && !phase.upgrade && <button type="button" className="btn secondary small" onClick={go}>Try again</button>}
            <button type="button" className="link" onClick={() => { reset(); setOpen(false); }}>Close</button></div>
        </div>
      )}
    </section>
  );
}
