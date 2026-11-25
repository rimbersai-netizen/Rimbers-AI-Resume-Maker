"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { applyImport, importStatus, startImport } from "./import-actions";

type Found = { name?: string; counts: Record<string, number>; dropped: number };

const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

/** Import an existing resume (PDF/Word): the profile is filled from it, then the user only picks a new template. */
export function ImportResumeCard({ hasProfileData }: { hasProfileData: boolean }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "working" | "ready" | "done">("idle");
  const [file, setFile] = useState("");
  const [error, setError] = useState<{ message: string; upgrade?: boolean } | null>(null);
  const [found, setFound] = useState<Found | null>(null);
  const [saving, setSaving] = useState(false);
  const job = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const fail = (message: string, upgrade = false) => { setPhase("idle"); setError({ message, upgrade }); };

  const poll = (id: string, tries = 0) => {
    timer.current = setTimeout(async () => {
      const s = await importStatus(id).catch(() => null);
      if (!s) return fail("We lost track of that import. Please try again.");
      if (s.status === "succeeded" && s.output.kind === "imported_profile") {
        const personal = (s.output.profile as { personal?: { fullName?: string } }).personal;
        setFound({ name: personal?.fullName, counts: s.output.counts, dropped: s.output.dropped });
        return setPhase("ready");
      }
      if (s.status === "failed" || s.status === "cancelled") return fail("message" in s ? s.message : "We could not read that file.");
      if (tries > 60) return fail("This is taking longer than expected. Please try again in a moment.");
      poll(id, tries + 1);
    }, 2000);
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    if (f.size > 5 * 1024 * 1024) return fail("That file is too large (max 5 MB).");
    setFile(f.name); setPhase("working");
    const fd = new FormData(); fd.set("file", f);
    const r = await startImport(fd).catch(() => null);
    if (!r) return fail("Something went wrong. Please try again.");
    if (!r.ok) return fail(r.message, r.upgrade);
    job.current = r.jobId;
    poll(r.jobId);
  };

  const use = async () => {
    if (!job.current) return;
    if (hasProfileData && !window.confirm("You already have details saved. Using this resume replaces them with what was found in the file (your photo is kept and the previous version stays in your profile history). Continue?")) return;
    setSaving(true); setError(null);
    const r = await applyImport(job.current, true).catch(() => null);
    setSaving(false);
    if (r?.ok) { setPhase("done"); router.refresh(); return; }
    setError({ message: r && "message" in r ? r.message : r && "issues" in r ? `Some imported values need fixing: ${Object.values(r.issues)[0]}. You can add them in your profile.` : "Could not save the imported details. Please try again." });
  };

  const c = found?.counts ?? {};
  const parts = [c.experience && plural(c.experience, "job", "jobs"), c.education && plural(c.education, "education entry", "education entries"), c.skills && plural(c.skills, "skill", "skills"), c.languages && plural(c.languages, "language", "languages"), c.certifications && plural(c.certifications, "certification", "certifications")].filter(Boolean);

  return (
    <section className="card wide import-card" aria-labelledby="imp-title">
      <h2 id="imp-title">{phase === "done" ? "✓ Resume imported" : "Import your existing resume"}</h2>
      <p className="muted">{phase === "done" ? <>Your details are now in your <Link href="/profile">profile</Link>. Pick a country and template below.</> : "Upload a PDF or Word file — we fill in your details so you only choose a new template."}</p>
      {phase === "working" && <p role="status" className="muted">Reading <strong>{file}</strong>… this takes a few seconds.</p>}
      {phase === "ready" && found && (
        <div className="alert ok" role="status">
          <strong>Found in your resume:</strong> {found.name ? `${found.name} — ` : ""}{parts.join(" · ") || "no details"}
          {found.dropped > 0 && <div className="small">Anything not clearly written in your file was left out.</div>}
          <button type="button" className="btn" onClick={use} disabled={saving}>{saving ? "Saving…" : "Use these details"}</button>
          <button type="button" className="btn secondary" onClick={() => { setPhase("idle"); setFound(null); }} disabled={saving}>Choose a different file</button>
        </div>
      )}
      {(phase === "idle" || phase === "done") && (
        <label className="btn secondary" style={{ cursor: "pointer" }}>
          {phase === "done" ? "Import a different file" : "Upload PDF or Word file"}
          <input type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
      )}
      {error && <div className="alert error" role="alert">{error.message}{error.upgrade && <> <Link href="/pricing">See plans</Link></>}</div>}
    </section>
  );
}
