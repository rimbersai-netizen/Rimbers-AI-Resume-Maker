"use client";

import Link from "next/link";
import { useState } from "react";
import type { PipelineItem, PipelineState } from "@/lib/services/jobs";
import { setState, undoState } from "./actions";
import { ago } from "./bits";

export const STATE_LABEL: Record<PipelineState, string> = {
  saved: "Saved", passed: "Passed", ready: "Ready to apply", applying: "Applying", applied: "Applied", needs_you: "Needs you", interview: "Interview", offer: "Offer", rejected: "Rejected",
};

export function PipelineList({ initial, mode }: { initial: PipelineItem[]; mode: "saved" | "applications" }) {
  const [items, setItems] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const change = async (it: PipelineItem, state: PipelineState) => {
    setBusy(it.id); setMsg(null);
    const r = await setState(it.key, state);
    setBusy(null);
    if (!r.ok) return setMsg(r.message);
    setItems((xs) => (mode === "saved" && state !== "saved" ? xs.filter((x) => x.id !== it.id) : xs.map((x) => (x.id === it.id ? r.value.item : x))));
  };
  const remove = async (it: PipelineItem) => {
    if (!confirm(`Remove “${it.title}” from your list?`)) return;
    setBusy(it.id);
    const ok = await undoState(it.id);
    setBusy(null);
    if (ok) setItems((xs) => xs.filter((x) => x.id !== it.id)); else setMsg("Could not remove it.");
  };

  if (!items.length) {
    return <div className="empty" style={{ marginTop: 16 }}>{mode === "saved"
      ? <p>Nothing saved yet. Tap the bookmark on a job in <Link href="/jobs">Discover</Link> to keep it here.</p>
      : <p>No applications yet. Add jobs from <Link href="/jobs">Discover</Link>, tailor your resume, then apply on the employer’s page and mark it here.</p>}</div>;
  }

  const order: PipelineState[] = mode === "saved" ? ["saved"] : ["ready", "applying", "needs_you", "applied", "interview", "offer", "rejected"];
  return (
    <div className="jobs-list">
      <p className="sr-only" role="status" aria-live="polite">{msg}</p>
      {msg && <p className="alert error" role="alert">{msg}</p>}
      {order.map((st) => {
        const group = items.filter((i) => i.state === st);
        if (!group.length) return null;
        return (
          <section key={st} aria-label={STATE_LABEL[st]}>
            <h2 className="jobs-h2">{STATE_LABEL[st]} <span className="badge">{group.length}</span></h2>
            <ul className="jobs-rows">
              {group.map((it) => (
                <li key={it.id} className="jobs-row">
                  <div className="jobs-row-main">
                    {it.logo ? <img src={it.logo} alt="" width={40} height={40} className="jobs-logo" /> : <span className="jobs-logo ph" aria-hidden>{it.company.charAt(0)}</span>}
                    <div>
                      <strong>{it.title}</strong>
                      <div className="muted small">{it.company}{it.location ? ` · ${it.location}` : ""} · {it.state === "applied" && it.appliedAt ? `applied ${ago(it.appliedAt)}` : `updated ${ago(it.updatedAt)}`}</div>
                    </div>
                    {it.matchScore != null && <span className="badge" title="Estimated match">{it.matchScore}</span>}
                  </div>
                  <div className="jobs-row-actions">
                    <Link className="link" href={`/jobs/tailor?key=${encodeURIComponent(it.key)}`}>{it.tailoredResumeId ? "Tailor again" : "Tailor resume"}</Link>
                    {it.tailoredResumeId && <Link className="link" href={`/resumes/${it.tailoredResumeId}`}>Open resume</Link>}
                    {it.url && st !== "applied" && (
                      <a className="link" href={it.url} target="_blank" rel="noopener noreferrer" onClick={() => { if (st === "ready" || st === "saved") void change(it, "applying"); }}>Apply on site ↗</a>
                    )}
                    {mode === "saved" && <button type="button" className="link" disabled={busy === it.id} onClick={() => change(it, "ready")}>Add to applications</button>}
                    {mode === "applications" && (
                      <label className="jobs-status">Status
                        <select value={it.state} disabled={busy === it.id} onChange={(e) => change(it, e.target.value as PipelineState)}>
                          {order.map((o) => <option key={o} value={o}>{STATE_LABEL[o]}</option>)}
                        </select>
                      </label>
                    )}
                    <button type="button" className="link danger" disabled={busy === it.id} onClick={() => remove(it)}>Remove</button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
