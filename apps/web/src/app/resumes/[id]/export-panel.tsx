"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getExport, requestExport, type ExportState } from "../actions";

/** Export panel (reference A-8 / B-10): choose format, wait for the worker, download via signed URL. */
export function ExportPanel({ resumeId, beforeExport }: { resumeId: string; beforeExport: () => Promise<void> }) {
  const [state, setState] = useState<ExportState | null>(null);
  const [error, setError] = useState<{ message: string; upgrade?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const poll = (id: string, started: number) => {
    timer.current = setTimeout(async () => {
      const s = await getExport(id).catch(() => null);
      if (!s) { setError({ message: "Lost track of the export. Please try again." }); setBusy(false); return; }
      setState(s);
      if (s.status === "succeeded" || s.status === "failed") { setBusy(false); return; }
      if (Date.now() - started > 90_000) { setError({ message: "This is taking longer than usual. We'll keep working — check back shortly." }); setBusy(false); return; }
      poll(id, started);
    }, 1200);
  };

  const start = async (format: "pdf" | "docx") => {
    setError(null); setState(null); setBusy(true);
    await beforeExport(); // flush pending layout changes so the file matches the preview
    const r = await requestExport(resumeId, format);
    if (!r.ok) { setBusy(false); setError({ message: r.message, upgrade: r.kind === "entitlement" }); return; }
    setState({ id: r.value.id, status: "queued" });
    poll(r.value.id, Date.now());
  };

  return (
    <section aria-labelledby="exp-title">
      <h2 id="exp-title">Download</h2>
      <div className="export-options">
        <button type="button" className="export-opt" onClick={() => start("pdf")} disabled={busy}>
          <span className="badge pdf" aria-hidden>PDF</span><span><strong>Download as PDF</strong><br /><span className="muted small">Best for job applications</span></span>
        </button>
        <button type="button" className="export-opt" onClick={() => start("docx")} disabled={busy}>
          <span className="badge docx" aria-hidden>DOCX</span><span><strong>Download as DOCX</strong><br /><span className="muted small">Editable in Microsoft Word · coming soon</span></span>
        </button>
      </div>
      <div aria-live="polite">
        {busy && <p className="muted small">{state?.status === "running" ? "Creating your PDF…" : "Preparing…"}</p>}
        {state?.status === "succeeded" && state.url && (
          <div className="alert ok"><strong>Your resume is ready!</strong> <a href={state.url} download>Download PDF</a> <span className="muted small">(link valid for 5 minutes)</span></div>
        )}
        {state?.status === "failed" && <div className="alert error" role="alert">{state.error}</div>}
        {error && <div className="alert error" role="alert">{error.message}{error.upgrade && <> <Link href="/account">See plans</Link></>}</div>}
      </div>
    </section>
  );
}
