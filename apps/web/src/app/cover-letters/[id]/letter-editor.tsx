"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { localeLabel, RESUME_LOCALES } from "@/lib/resume-settings";
import { deleteCoverLetter, getLetterExport, requestLetterExport, saveCoverLetter } from "../actions";

type Letter = { id: string; title: string; body: string; locale: string; page_size: string; job_title: string | null; company: string | null; resume_id: string | null };

export function LetterEditor({ letter }: { letter: Letter }) {
  const router = useRouter();
  const [title, setTitle] = useState(letter.title);
  const [body, setBody] = useState(letter.body);
  const [locale, setLocale] = useState(letter.locale);
  const [pageSize, setPageSize] = useState(letter.page_size as "A4" | "Letter");
  const [status, setStatus] = useState("");
  const [exp, setExp] = useState<{ busy: boolean; url?: string; message?: string; format?: string }>({ busy: false });
  const dirty = useRef(false);
  const rtl = /^(ar|ur|fa)/.test(locale);

  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(async () => {
      setStatus("Saving…");
      const r = await saveCoverLetter(letter.id, { title, body, locale: locale as never, pageSize, jobTitle: letter.job_title ?? undefined, company: letter.company ?? undefined, resumeId: letter.resume_id ?? undefined }).catch(() => null);
      if (r?.ok) { dirty.current = false; setStatus("All changes saved"); } else setStatus(r ? r.message : "Offline — will retry when you edit again.");
    }, 800);
    return () => clearTimeout(t);
  }, [title, body, locale, pageSize, letter]);
  const edit = <T,>(fn: (v: T) => void) => (v: T) => { dirty.current = true; fn(v); };

  const download = async (format: "pdf" | "docx") => {
    setExp({ busy: true, format });
    const r = await requestLetterExport(letter.id, format);
    if (!r.ok) return setExp({ busy: false, message: r.message });
    for (let i = 0; i < 60; i++) {
      await new Promise((res) => setTimeout(res, 1200));
      const s = await getLetterExport(r.exportId);
      if (s?.status === "succeeded") return setExp({ busy: false, url: s.url, format });
      if (s?.status === "failed") return setExp({ busy: false, message: s.message });
    }
    setExp({ busy: false, message: "This is taking longer than usual. Please try again shortly." });
  };

  return (
    <div className="builder">
      <header className="builder-head">
        <Link href="/cover-letters" className="muted">← Cover letters</Link>
        <input aria-label="Letter name" className="title-input" value={title} maxLength={200} onChange={(e) => edit(setTitle)(e.target.value)} />
        <p className="save-status" role="status" aria-live="polite">{status}</p>
      </header>
      <section className="card wide">
        <div className="grid3">
          <div className="field"><label htmlFor="lang">Letter language</label><select id="lang" value={locale} onChange={(e) => edit(setLocale)(e.target.value)}>{RESUME_LOCALES.map((l) => <option key={l} value={l}>{localeLabel(l)}</option>)}</select></div>
          <div className="field"><label htmlFor="ps">Page size</label><select id="ps" value={pageSize} onChange={(e) => edit(setPageSize)(e.target.value as "A4" | "Letter")}><option>A4</option><option>Letter</option></select></div>
        </div>
        <label htmlFor="body">Letter</label>
        <textarea id="body" rows={18} maxLength={20000} dir={rtl ? "rtl" : "auto"} value={body} onChange={(e) => edit(setBody)(e.target.value)} />
        <p className="muted small">Separate paragraphs with a blank line. Check every detail is true before sending.</p>
        <div className="row">
          <button type="button" className="btn secondary small" onClick={async () => { await navigator.clipboard.writeText(body).catch(() => undefined); setStatus("Copied to clipboard"); }}>Copy</button>
          <button type="button" className="btn small" disabled={exp.busy} onClick={() => download("pdf")}>Download PDF</button>
          <button type="button" className="btn secondary small" disabled={exp.busy} onClick={() => download("docx")}>Download DOCX</button>
          <button type="button" className="link" onClick={async () => { if (window.confirm("Delete this cover letter?")) { const r = await deleteCoverLetter(letter.id); if (r.ok) router.push("/cover-letters"); } }}>Delete</button>
        </div>
        <div aria-live="polite">
          {exp.busy && <p className="muted small">Creating your {exp.format?.toUpperCase()}…</p>}
          {exp.url && <div className="alert ok">Ready: <a href={exp.url} download>Download {exp.format?.toUpperCase()}</a> <span className="muted small">(link valid for 5 minutes)</span></div>}
          {exp.message && <div className="alert error" role="alert">{exp.message} <Link href="/account">See plans</Link></div>}
        </div>
      </section>
    </div>
  );
}
