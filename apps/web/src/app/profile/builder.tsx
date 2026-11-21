"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { LAUNCH_COUNTRIES } from "@gars/shared-types";
import {
  issuesForStep, move, newId, prepareForSave, recoveryDecision, stepComplete, STEPS,
  mergeAcceptedBullets, toDraft, type Draft, type Issues, type LocalDraft, type Step,
} from "@/lib/profile-draft";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { getVersionSnapshot, listVersions, saveProfile, type Loaded } from "./actions";
import { Checkbox, MonthField, Select, TextArea, TextField } from "./fields";
import { BulletsAssistant, SummaryAssistant } from "./ai-assistant";

type Status = "idle" | "saving" | "saved" | "invalid" | "offline" | "conflict" | "error";
const STEP_LABEL: Record<Step, string> = { personal: "Personal", experience: "Experience", education: "Education", skills: "Skills", review: "Review" };
const EMPLOYMENT = [
  ["full_time", "Full-time"], ["part_time", "Part-time"], ["contract", "Contract"], ["internship", "Internship"],
  ["freelance", "Freelance"], ["temporary", "Temporary"], ["volunteer", "Volunteer"],
].map(([value, label]) => ({ value: value as NonNullable<Draft["experience"][number]["employmentType"]>, label: label! }));
const PROFICIENCY = (["native", "C2", "C1", "B2", "B1", "A2", "A1"] as const).map((v) => ({ value: v, label: v === "native" ? "Native" : v }));
const LS_KEY = (id: string) => `gars.profileDraft.${id}`;
const AUTOSAVE_MS = 1200;

function countryOptions() {
  let names: Intl.DisplayNames | null = null;
  try { names = new Intl.DisplayNames(["en"], { type: "region" }); } catch { /* old browsers */ }
  return LAUNCH_COUNTRIES.map((c) => ({ value: c, label: names?.of(c) ?? c })).sort((a, b) => a.label.localeCompare(b.label));
}
const readLocal = (id: string): LocalDraft | null => { try { const s = localStorage.getItem(LS_KEY(id)); return s ? JSON.parse(s) : null; } catch { return null; } };
const writeLocal = (v: LocalDraft) => { try { localStorage.setItem(LS_KEY(v.profileId), JSON.stringify(v)); } catch { /* storage full/blocked */ } };
const clearLocal = (id: string) => { try { localStorage.removeItem(LS_KEY(id)); } catch { /* ignore */ } };

export function ProfileBuilder({ initial, userId }: { initial: Loaded; userId: string }) {
  const [draft, setDraft] = useState<Draft>(initial.profile);
  const [step, setStep] = useState<Step>("personal");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");
  const [issues, setIssues] = useState<Issues>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [recovery, setRecovery] = useState<{ kind: "restore" | "restore_conflict"; local: LocalDraft } | null>(null);
  const updatedAt = useRef<string>(initial.updatedAt);
  const dirty = useRef(false);
  const saving = useRef(false);
  const pending = useRef(false);
  const latest = useRef(draft);
  latest.current = draft;
  const countries = useMemo(countryOptions, []);

  // ---- crash recovery offer on mount
  useEffect(() => {
    const local = readLocal(initial.id);
    const d = recoveryDecision(local, initial);
    if (d !== "none" && local) setRecovery({ kind: d, local });
    else if (local) clearLocal(initial.id);
  }, [initial]);

  const runSave = useCallback(async (opts: { force?: boolean; label?: string } = {}) => {
    if (saving.current) { pending.current = true; return; }
    const snapshot = latest.current;
    const check = prepareForSave(snapshot);
    if (!check.ok) { setIssues(check.issues); setStatus("invalid"); setMessage(`Not saved yet — ${Object.keys(check.issues).length} field(s) need attention.`); return; }
    setIssues({});
    saving.current = true;
    setStatus("saving");
    try {
      const r = await saveProfile(initial.id, snapshot, opts.force ? null : updatedAt.current, opts.label);
      if (r.ok) {
        updatedAt.current = r.updatedAt;
        if (latest.current === snapshot) { dirty.current = false; clearLocal(initial.id); }
        setStatus("saved");
        setMessage(r.version ? `Saved as version ${r.version}` : "All changes saved");
      } else if (r.kind === "invalid") { setIssues(r.issues); setStatus("invalid"); setMessage("Not saved — check highlighted fields."); }
      else if (r.kind === "conflict") { setStatus("conflict"); setMessage("This profile was changed on another device or tab."); }
      else { setStatus(r.kind === "auth" ? "error" : "error"); setMessage(r.message); }
    } catch {
      setStatus("offline");
      setMessage("You appear to be offline. Changes are kept on this device and will save when you reconnect.");
    } finally {
      saving.current = false;
      if (pending.current) { pending.current = false; void runSave(); }
    }
  }, [initial.id]);

  /** Save immediately (AI reads the saved profile). Resolves false if the draft is invalid or saving failed. */
  const saveNow = async (): Promise<boolean> => {
    if (!prepareForSave(latest.current).ok) { setShowAll(true); return false; }
    if (dirty.current || saving.current) {
      await runSave();
      for (let i = 0; i < 40 && saving.current; i++) await new Promise((r) => setTimeout(r, 100));
    }
    return !dirty.current;
  };
  const appLocale = typeof document !== "undefined" ? document.documentElement.lang || "en" : "en";

  // ---- autosave: local copy immediately, server after a pause
  useEffect(() => {
    if (!dirty.current) return;
    writeLocal({ profileId: initial.id, draft, baseUpdatedAt: updatedAt.current, savedAt: new Date().toISOString() });
    const t = setTimeout(() => void runSave(), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [draft, initial.id, runSave]);

  useEffect(() => {
    const online = () => { if (dirty.current) void runSave(); };
    const leave = (e: BeforeUnloadEvent) => { if (dirty.current) { e.preventDefault(); } };
    window.addEventListener("online", online);
    window.addEventListener("beforeunload", leave);
    return () => { window.removeEventListener("online", online); window.removeEventListener("beforeunload", leave); };
  }, [runSave]);

  const update = (fn: (d: Draft) => Draft) => { dirty.current = true; setDraft((d) => fn(structuredClone(d))); };
  const touch = (path: string) => () => setTouched((t) => (t.has(path) ? t : new Set(t).add(path)));
  const err = (path: string) => (showAll || touched.has(path) ? issues[path] : undefined);

  // Client-side validation runs on every change so errors clear as the user types.
  useEffect(() => {
    const r = prepareForSave(draft);
    setIssues(r.ok ? {} : r.issues);
  }, [draft]);

  const goNext = () => {
    const stepIssues = issuesForStep(issues, step);
    // Email is optional in the shared schema (imports may lack it) but required to finish the Personal step.
    const missingEmail = step === "personal" && !draft.personal.email?.trim();
    if (stepIssues.length || missingEmail) {
      setShowAll(true);
      // Focus after React has rendered aria-invalid on the fields.
      setTimeout(() => document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus(), 0);
      return;
    }
    const i = STEPS.indexOf(step);
    if (i < STEPS.length - 1) { setStep(STEPS[i + 1]!); window.scrollTo({ top: 0 }); }
  };

  return (
    <div className="builder">
      <header className="builder-head">
        <Link href="/dashboard" className="muted">← Dashboard</Link>
        <h1>Create your profile</h1>
        <SaveStatus status={status} message={message} onRetry={() => void runSave()} onOverwrite={() => void runSave({ force: true })} />
      </header>

      {recovery && (
        <div className={`alert ${recovery.kind === "restore" ? "ok" : "error"}`} role="alert">
          <p>{recovery.kind === "restore"
            ? `We found unsaved changes from ${new Date(recovery.local.savedAt).toLocaleString()}.`
            : "We found unsaved changes on this device, but your profile was updated elsewhere since. Restoring will overwrite the newer version."}</p>
          <div className="row">
            <button className="btn small" type="button" onClick={() => { dirty.current = true; setDraft(toDraft(recovery.local.draft)); setRecovery(null); }}>Restore changes</button>
            <button className="btn secondary small" type="button" onClick={() => { clearLocal(initial.id); setRecovery(null); }}>Discard</button>
          </div>
        </div>
      )}

      <nav aria-label="Profile steps">
        <ol className="stepper">
          {STEPS.map((s, i) => {
            const bad = issuesForStep(issues, s).length > 0 && (showAll || [...touched].some((t) => issuesForStep({ [t]: "x" }, s).length));
            return (
              <li key={s}>
                <button type="button" aria-current={s === step ? "step" : undefined} onClick={() => setStep(s)}
                  className={`${s === step ? "active" : ""} ${stepComplete(draft, s) ? "done" : ""} ${bad ? "bad" : ""}`}>
                  <span className="num">{stepComplete(draft, s) && s !== step ? "✓" : i + 1}</span>
                  <span className="lbl">{STEP_LABEL[s]}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <section className="card wide" aria-labelledby="step-title">
        <h2 id="step-title">{STEP_LABEL[step]}{step === "personal" ? " information" : ""}</h2>

        {step === "personal" && (
          <div className="grid2">
            <PhotoField userId={userId} path={draft.personal.photoPath} onChange={(p) => update((d) => { d.personal.photoPath = p; return d; })} />
            <TextField label="Full name" required value={draft.personal.fullName} maxLength={200} autoComplete="name" error={err("personal.fullName")} onBlur={touch("personal.fullName")} onChange={(v) => update((d) => { d.personal.fullName = v; return d; })} />
            <TextField label="Job title / Professional title" value={draft.personal.professionalTitle} maxLength={200} autoComplete="organization-title" onChange={(v) => update((d) => { d.personal.professionalTitle = v; return d; })} />
            <TextField label="Email" required type="email" dir="ltr" value={draft.personal.email} maxLength={254} autoComplete="email" error={err("personal.email") ?? (showAll && !draft.personal.email ? "Required" : undefined)} onBlur={touch("personal.email")} onChange={(v) => update((d) => { d.personal.email = v; return d; })} />
            <TextField label="Phone" type="tel" dir="ltr" value={draft.personal.phone} maxLength={40} autoComplete="tel" placeholder="+966 55 123 4567" hint="Include the country code" error={err("personal.phone")} onBlur={touch("personal.phone")} onChange={(v) => update((d) => { d.personal.phone = v; return d; })} />
            <TextField label="City" value={draft.personal.location.city} maxLength={200} autoComplete="address-level2" onChange={(v) => update((d) => { d.personal.location.city = v; return d; })} />
            <Select label="Country" value={draft.personal.location.country as (typeof LAUNCH_COUNTRIES)[number] | undefined} options={countries} onChange={(v) => update((d) => { d.personal.location.country = v; return d; })} />
            <TextField label="LinkedIn" type="url" dir="ltr" value={draft.personal.linkedin} maxLength={500} placeholder="https://linkedin.com/in/…" error={err("personal.linkedin")} onBlur={touch("personal.linkedin")} onChange={(v) => update((d) => { d.personal.linkedin = v; return d; })} />
            <TextField label="Website / Portfolio" type="url" dir="ltr" value={draft.personal.website} maxLength={500} placeholder="https://…" error={err("personal.website")} onBlur={touch("personal.website")} onChange={(v) => update((d) => { d.personal.website = v; return d; })} />
            <div className="span2">
              <TextArea label="Professional summary" value={draft.summary} maxLength={1200} rows={4} placeholder="2–4 sentences about your experience and focus — or let the AI assistant draft one from your profile."
                onChange={(v) => update((d) => { d.summary = v; return d; })} />
              <SummaryAssistant masterProfileId={initial.id} locale={appLocale} hasSummary={Boolean(draft.summary?.trim())} prepare={saveNow}
                onAccept={(text) => update((d) => { d.summary = text; return d; })} />
            </div>
            <details className="span2">
              <summary>More personal details (optional)</summary>
              <p className="muted small">Only add what you are comfortable sharing. Some countries expect work-permit status; others discourage personal details.</p>
              <TextField label="Work authorization / visa status" value={draft.personal.workAuthorization} maxLength={200} onChange={(v) => update((d) => { d.personal.workAuthorization = v; return d; })} />
            </details>
          </div>
        )}

        {step === "experience" && (
          <>
            {draft.experience.length === 0 && <p className="empty">No work experience yet. Add your most recent role first — internships and freelance work count too.</p>}
            {draft.experience.map((w, i) => (
              <ItemCard key={w.id} title={w.title || "New role"} subtitle={w.employer} index={i} count={draft.experience.length}
                onMove={(to) => update((d) => { d.experience = move(d.experience, i, to); return d; })}
                onRemove={() => update((d) => { d.experience.splice(i, 1); return d; })}>
                <div className="grid2">
                  <TextField label="Job title" required value={w.title} maxLength={200} error={err(`experience.${i}.title`)} onBlur={touch(`experience.${i}.title`)} onChange={(v) => update((d) => { d.experience[i]!.title = v; return d; })} />
                  <TextField label="Company" required value={w.employer} maxLength={200} error={err(`experience.${i}.employer`)} onBlur={touch(`experience.${i}.employer`)} onChange={(v) => update((d) => { d.experience[i]!.employer = v; return d; })} />
                  <Select label="Employment type" value={w.employmentType} options={EMPLOYMENT} onChange={(v) => update((d) => { d.experience[i]!.employmentType = v; return d; })} />
                  <TextField label="Location" value={w.location} maxLength={200} onChange={(v) => update((d) => { d.experience[i]!.location = v; return d; })} />
                  <MonthField label="Start date" value={w.dates.start} onChange={(v) => update((d) => { d.experience[i]!.dates.start = v; return d; })} />
                  <MonthField label="End date" value={w.dates.end} disabled={w.dates.current} error={err(`experience.${i}.dates.end`)} onChange={(v) => update((d) => { d.experience[i]!.dates.end = v; return d; })} />
                  <div className="span2"><Checkbox label="I currently work here" checked={w.dates.current} onChange={(c) => update((d) => { d.experience[i]!.dates.current = c; if (c) delete d.experience[i]!.dates.end; return d; })} /></div>
                </div>
                <fieldset className="bullets-edit">
                  <legend>Responsibilities &amp; achievements</legend>
                  <p className="muted small">Write what you actually did. Add real figures only where you know them.</p>
                  {w.bullets.map((b, bi) => (
                    <div className="bullet-row" key={b.id}>
                      <span aria-hidden>•</span>
                      <textarea aria-label={`Bullet ${bi + 1}`} rows={2} maxLength={600} value={b.text}
                        onChange={(e) => update((d) => { d.experience[i]!.bullets[bi]!.text = e.target.value; d.experience[i]!.bullets[bi]!.provenance = "user"; return d; })} />
                      <button type="button" className="icon" aria-label={`Remove bullet ${bi + 1}`} onClick={() => update((d) => { d.experience[i]!.bullets.splice(bi, 1); return d; })}>×</button>
                    </div>
                  ))}
                  {w.bullets.length < 12 && <button type="button" className="link" onClick={() => update((d) => { d.experience[i]!.bullets.push({ id: newId(), text: "", provenance: "user" }); return d; })}>+ Add bullet</button>}
                  {w.employer && w.title && w.bullets.some((b) => b.text.trim()) && (
                    <BulletsAssistant masterProfileId={initial.id} experienceId={w.id} locale={appLocale} prepare={saveNow}
                      onAccept={(bullets) => update((d) => { d.experience[i]!.bullets = mergeAcceptedBullets(d.experience[i]!.bullets, bullets); return d; })} />
                  )}
                </fieldset>
              </ItemCard>
            ))}
            <button type="button" className="btn secondary" onClick={() => update((d) => { d.experience.unshift({ id: newId(), employer: "", title: "", dates: { current: false }, bullets: [{ id: newId(), text: "", provenance: "user" }] }); return d; })}>+ Add work experience</button>
          </>
        )}

        {step === "education" && (
          <>
            {draft.education.length === 0 && <p className="empty">Add your degrees, diplomas or training.</p>}
            {draft.education.map((e, i) => (
              <ItemCard key={e.id} title={e.qualification || "New qualification"} subtitle={e.institution} index={i} count={draft.education.length}
                onMove={(to) => update((d) => { d.education = move(d.education, i, to); return d; })}
                onRemove={() => update((d) => { d.education.splice(i, 1); return d; })}>
                <div className="grid2">
                  <TextField label="Qualification" required placeholder="B.Sc. in Computer Science" value={e.qualification} maxLength={200} error={err(`education.${i}.qualification`)} onBlur={touch(`education.${i}.qualification`)} onChange={(v) => update((d) => { d.education[i]!.qualification = v; return d; })} />
                  <TextField label="Institution" required value={e.institution} maxLength={200} error={err(`education.${i}.institution`)} onBlur={touch(`education.${i}.institution`)} onChange={(v) => update((d) => { d.education[i]!.institution = v; return d; })} />
                  <TextField label="Field of study" value={e.field} maxLength={200} onChange={(v) => update((d) => { d.education[i]!.field = v; return d; })} />
                  <TextField label="Grade (optional)" value={e.grade} maxLength={100} onChange={(v) => update((d) => { d.education[i]!.grade = v; return d; })} />
                  <MonthField label="Start" value={e.dates.start} onChange={(v) => update((d) => { d.education[i]!.dates.start = v; return d; })} />
                  <MonthField label="End (or expected)" value={e.dates.end} error={err(`education.${i}.dates.end`)} onChange={(v) => update((d) => { d.education[i]!.dates.end = v; return d; })} />
                </div>
              </ItemCard>
            ))}
            <button type="button" className="btn secondary" onClick={() => update((d) => { d.education.push({ id: newId(), institution: "", qualification: "", dates: { current: false } }); return d; })}>+ Add education</button>
          </>
        )}

        {step === "skills" && (
          <>
            <SkillsEditor skills={draft.skills} onChange={(s) => update((d) => { d.skills = s; return d; })} />
            <h3>Languages</h3>
            {draft.languages.map((l, i) => (
              <div className="grid3" key={l.id}>
                <TextField label="Language" required value={l.language} maxLength={100} error={err(`languages.${i}.language`)} onBlur={touch(`languages.${i}.language`)} onChange={(v) => update((d) => { d.languages[i]!.language = v; return d; })} />
                <Select label="Level" value={l.proficiency} options={PROFICIENCY} onChange={(v) => update((d) => { d.languages[i]!.proficiency = v; return d; })} />
                <button type="button" className="btn secondary small align-end" onClick={() => update((d) => { d.languages.splice(i, 1); return d; })}>Remove</button>
              </div>
            ))}
            <button type="button" className="link" onClick={() => update((d) => { d.languages.push({ id: newId(), language: "" }); return d; })}>+ Add language</button>
            <h3>Certifications</h3>
            {draft.certifications.map((c, i) => (
              <ItemCard key={c.id} title={c.name || "New certification"} subtitle={c.issuer} index={i} count={draft.certifications.length}
                onMove={(to) => update((d) => { d.certifications = move(d.certifications, i, to); return d; })} onRemove={() => update((d) => { d.certifications.splice(i, 1); return d; })}>
                <div className="grid2">
                  <TextField label="Certification" required value={c.name} maxLength={200} error={err(`certifications.${i}.name`)} onBlur={touch(`certifications.${i}.name`)} onChange={(v) => update((d) => { d.certifications[i]!.name = v; return d; })} />
                  <TextField label="Issuer" value={c.issuer} maxLength={200} onChange={(v) => update((d) => { d.certifications[i]!.issuer = v; return d; })} />
                  <MonthField label="Issued" value={c.issued} onChange={(v) => update((d) => { d.certifications[i]!.issued = v; return d; })} />
                  <TextField label="Credential link" type="url" dir="ltr" value={c.credentialUrl} maxLength={500} error={err(`certifications.${i}.credentialUrl`)} onBlur={touch(`certifications.${i}.credentialUrl`)} onChange={(v) => update((d) => { d.certifications[i]!.credentialUrl = v; return d; })} />
                </div>
              </ItemCard>
            ))}
            <button type="button" className="link" onClick={() => update((d) => { d.certifications.push({ id: newId(), name: "" }); return d; })}>+ Add certification</button>
            <h3>Projects</h3>
            {draft.projects.map((p, i) => (
              <ItemCard key={p.id} title={p.name || "New project"} subtitle={p.role} index={i} count={draft.projects.length}
                onMove={(to) => update((d) => { d.projects = move(d.projects, i, to); return d; })} onRemove={() => update((d) => { d.projects.splice(i, 1); return d; })}>
                <div className="grid2">
                  <TextField label="Project name" required value={p.name} maxLength={200} error={err(`projects.${i}.name`)} onBlur={touch(`projects.${i}.name`)} onChange={(v) => update((d) => { d.projects[i]!.name = v; return d; })} />
                  <TextField label="Your role" value={p.role} maxLength={200} onChange={(v) => update((d) => { d.projects[i]!.role = v; return d; })} />
                  <div className="span2"><TextArea label="Description" value={p.description} maxLength={1000} rows={3} onChange={(v) => update((d) => { d.projects[i]!.description = v; return d; })} /></div>
                  <TextField label="Link" type="url" dir="ltr" value={p.url} maxLength={500} error={err(`projects.${i}.url`)} onBlur={touch(`projects.${i}.url`)} onChange={(v) => update((d) => { d.projects[i]!.url = v; return d; })} />
                </div>
              </ItemCard>
            ))}
            <button type="button" className="link" onClick={() => update((d) => { d.projects.push({ id: newId(), name: "" }); return d; })}>+ Add project</button>
          </>
        )}

        {step === "review" && (
          <ReviewStep draft={draft} issues={issues} profileId={initial.id} onGoto={setStep}
            onSnapshot={(label) => runSave({ label })}
            onRestore={(d) => { dirty.current = true; setDraft(d); setStatus("idle"); setMessage("Version restored — saving…"); }} />
        )}
      </section>

      <div className="action-bar">
        {step !== "personal" && <button type="button" className="btn secondary" onClick={() => setStep(STEPS[STEPS.indexOf(step) - 1]!)}>Back</button>}
        {step !== "review"
          ? <button type="button" className="btn" onClick={goNext}>Save &amp; continue <span className="arrow" aria-hidden>→</span></button>
          : <button type="button" className="btn" onClick={() => { setShowAll(true); void runSave(); }}>Save profile</button>}
      </div>
    </div>
  );
}

function SaveStatus({ status, message, onRetry, onOverwrite }: { status: Status; message: string; onRetry: () => void; onOverwrite: () => void }) {
  const label: Record<Status, string> = { idle: "", saving: "Saving…", saved: message || "Saved", invalid: message, offline: message, conflict: message, error: message };
  if (status === "idle") return <p className="save-status" aria-live="polite" />;
  return (
    <div className={`save-status ${status}`} role={status === "error" || status === "conflict" ? "alert" : "status"} aria-live="polite">
      <span>{label[status]}</span>
      {(status === "error" || status === "offline") && <button type="button" className="link" onClick={onRetry}>Retry</button>}
      {status === "conflict" && (
        <>
          <button type="button" className="link" onClick={() => window.location.reload()}>Load latest</button>
          <button type="button" className="link" onClick={onOverwrite}>Keep my version</button>
        </>
      )}
    </div>
  );
}

function ItemCard(p: { title: string; subtitle?: string; index: number; count: number; onMove: (to: number) => void; onRemove: () => void; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <article className="item-card">
      <header>
        <button type="button" className="item-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <strong>{p.title}</strong>{p.subtitle && <span className="muted"> · {p.subtitle}</span>}
        </button>
        <div className="item-actions">
          <button type="button" className="icon" aria-label="Move up" disabled={p.index === 0} onClick={() => p.onMove(p.index - 1)}>↑</button>
          <button type="button" className="icon" aria-label="Move down" disabled={p.index === p.count - 1} onClick={() => p.onMove(p.index + 1)}>↓</button>
          <button type="button" className="icon danger" aria-label={`Delete ${p.title}`} onClick={() => { if (window.confirm(`Delete "${p.title}"?`)) p.onRemove(); }}>🗑</button>
        </div>
      </header>
      {open && p.children}
    </article>
  );
}

function SkillsEditor({ skills, onChange }: { skills: Draft["skills"]; onChange: (s: Draft["skills"]) => void }) {
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const add = () => {
    const names = text.split(",").map((s) => s.trim()).filter(Boolean);
    const have = new Set(skills.map((s) => s.name.toLowerCase()));
    const fresh = names.filter((n, i) => !have.has(n.toLowerCase()) && names.findIndex((m) => m.toLowerCase() === n.toLowerCase()) === i && n.length <= 100);
    setNote(fresh.length < names.length ? "Duplicates were skipped." : "");
    if (fresh.length) onChange([...skills, ...fresh.map((name) => ({ id: newId(), name }))]);
    setText("");
  };
  return (
    <div className="field">
      <label htmlFor="skill-input">Skills</label>
      <div className="chip-input">
        <input id="skill-input" value={text} placeholder="Type a skill and press Enter (comma-separate several)" maxLength={300}
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button type="button" className="btn small" onClick={add}>+ Add</button>
      </div>
      {note && <p className="muted small" role="status">{note}</p>}
      <ul className="chips" aria-label="Your skills">
        {skills.map((s, i) => (
          <li key={s.id} className="chip">{s.name}
            <button type="button" aria-label={`Remove ${s.name}`} onClick={() => onChange(skills.filter((_, j) => j !== i))}>×</button>
          </li>
        ))}
      </ul>
      {skills.length < 3 && <p className="muted small">Most resumes list 6–15 skills you actually use.</p>}
    </div>
  );
}

function PhotoField({ userId, path, onChange }: { userId: string; path?: string; onChange: (p: string | undefined) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const supabase = useMemo(createBrowserClient, []);
  useEffect(() => {
    let live = true;
    if (!path) { setUrl(null); return; }
    supabase.storage.from("profile-photos").createSignedUrl(path, 3600).then(({ data }) => { if (live) setUrl(data?.signedUrl ?? null); });
    return () => { live = false; };
  }, [path, supabase]);
  const upload = async (file: File) => {
    setError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return setError("Use a JPG, PNG or WebP image.");
    if (file.size > 5 * 1024 * 1024) return setError("Image must be 5 MB or smaller.");
    setBusy(true);
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const p = `${userId}/photo-${Date.now()}.${ext}`;
    const { error: e } = await supabase.storage.from("profile-photos").upload(p, file, { contentType: file.type, upsert: false });
    setBusy(false);
    if (e) return setError("Upload failed. Please try again.");
    if (path) void supabase.storage.from("profile-photos").remove([path]);
    onChange(p);
  };
  return (
    <div className="photo-field span2">
      <div className="avatar" aria-hidden={!url}>{url ? <img src={url} alt="Your profile photo" /> : <span>📷</span>}</div>
      <div>
        <label className="btn secondary small" htmlFor="photo-input">{busy ? "Uploading…" : path ? "Change photo" : "Add photo (optional)"}</label>
        <input id="photo-input" type="file" accept="image/jpeg,image/png,image/webp" className="visually-hidden" disabled={busy}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
        {path && <button type="button" className="link" onClick={() => { void supabase.storage.from("profile-photos").remove([path]); onChange(undefined); }}>Remove</button>}
        <p className="muted small">Photos are common in some countries and discouraged in others. You choose per resume.</p>
        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
    </div>
  );
}

function ReviewStep(p: { draft: Draft; issues: Issues; profileId: string; onGoto: (s: Step) => void; onSnapshot: (label: string) => Promise<void>; onRestore: (d: Draft) => void }) {
  const [versions, setVersions] = useState<Awaited<ReturnType<typeof listVersions>>>([]);
  const [label, setLabel] = useState("");
  const refresh = useCallback(() => { void listVersions(p.profileId).then(setVersions); }, [p.profileId]);
  useEffect(refresh, [refresh]);
  return (
    <>
      <ul className="review-list">
        {STEPS.slice(0, 4).map((s) => {
          const n = issuesForStep(p.issues, s).length;
          return (
            <li key={s}>
              <span className={stepComplete(p.draft, s) && n === 0 ? "ok" : "todo"}>{stepComplete(p.draft, s) && n === 0 ? "✓" : "•"}</span>
              <strong>{STEP_LABEL[s]}</strong>
              <span className="muted">{n ? `${n} field(s) need attention` : stepComplete(p.draft, s) ? "Complete" : "Incomplete"}</span>
              <button type="button" className="link" onClick={() => p.onGoto(s)}>Edit</button>
            </li>
          );
        })}
      </ul>
      <h3>Versions</h3>
      <p className="muted small">Save a named version before big changes. You can restore it later; resumes you create keep their own copies.</p>
      <div className="chip-input">
        <input aria-label="Version name" placeholder="e.g. Before tailoring for Aramco" value={label} maxLength={120} onChange={(e) => setLabel(e.target.value)} />
        <button type="button" className="btn small" onClick={async () => { await p.onSnapshot(label || "Snapshot"); setLabel(""); refresh(); }}>Save version</button>
      </div>
      {versions.length === 0 ? <p className="empty">No saved versions yet.</p> : (
        <ul className="versions">
          {versions.map((v) => (
            <li key={v.id}>
              <span>v{v.version_no} · {v.label ?? "Snapshot"} · <time dateTime={v.created_at}>{new Date(v.created_at).toLocaleString()}</time></span>
              <button type="button" className="link" onClick={async () => {
                if (!window.confirm(`Restore v${v.version_no}? Your current profile will be replaced (save a version first if you need it).`)) return;
                const snap = await getVersionSnapshot(v.id);
                if (snap) p.onRestore(snap);
              }}>Restore</button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
