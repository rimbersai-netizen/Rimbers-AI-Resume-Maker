"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Prefs } from "@/lib/services/jobs";
import { savePreferences } from "../actions";

const MODES = [["remote", "Remote"], ["hybrid", "Hybrid"], ["onsite", "On-site"]] as const;
const SALARY = [[null, "Any"], [30000, "$30k+"], [50000, "$50k+"], [75000, "$75k+"], [100000, "$100k+"], [150000, "$150k+"]] as const;
const FRESH = [[null, "Any time"], [1, "Past 24 hours"], [3, "Past 3 days"], [7, "Past week"], [14, "Past 2 weeks"], [30, "Past month"]] as const;
const STEPS = ["Roles", "Work style", "Pay and freshness"];

export function PreferencesForm({ initial, roles }: { initial: Prefs; roles: { id: string; label: string; hint: string }[] }) {
  const router = useRouter();
  const [p, setP] = useState<Prefs>(initial);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toggle = <T extends string>(xs: T[], v: T) => (xs.includes(v) ? xs.filter((x) => x !== v) : [...xs, v]);

  const save = async () => {
    setBusy(true); setErr(null);
    const r = await savePreferences(p);
    setBusy(false);
    if (!r.ok) return setErr(r.message);
    router.push("/jobs"); router.refresh();
  };

  return (
    <section className="card wide jobs-prefs" aria-label="Job preferences">
      <ol className="jobs-steps" aria-label="Progress">{STEPS.map((s, i) => <li key={s} aria-current={i === step ? "step" : undefined} className={i <= step ? "on" : ""}><span className="visually-hidden">{s}</span></li>)}</ol>
      <h2>{STEPS[step]}</h2>
      {step === 0 && (<>
        <p className="muted">Pick the roles you want to see. Choose as many as you like, or none to see everything.</p>
        <div className="jobs-options" role="group" aria-label="Roles">
          {roles.map((r) => (
            <label key={r.id} className={`jobs-option${p.roles.includes(r.id as never) ? " on" : ""}`}>
              <input type="checkbox" checked={p.roles.includes(r.id as never)} onChange={() => setP({ ...p, roles: toggle(p.roles, r.id as never) })} />
              <span><strong>{r.label}</strong><small className="muted">{r.hint}</small></span>
            </label>
          ))}
        </div>
      </>)}
      {step === 1 && (<>
        <p className="muted">Where do you want to work? Leave empty to see all.</p>
        <div className="jobs-options" role="group" aria-label="Work style">
          {MODES.map(([id, label]) => (
            <label key={id} className={`jobs-option${p.workModes.includes(id) ? " on" : ""}`}>
              <input type="checkbox" checked={p.workModes.includes(id)} onChange={() => setP({ ...p, workModes: toggle(p.workModes, id) })} /><span><strong>{label}</strong></span>
            </label>
          ))}
        </div>
      </>)}
      {step === 2 && (<>
        <p className="muted">Set a salary floor and how recent postings should be. Listings that don’t state a salary are still shown.</p>
        <label>Minimum salary (yearly)
          <select value={p.minSalary ?? ""} onChange={(e) => setP({ ...p, minSalary: e.target.value ? Number(e.target.value) : null })}>
            {SALARY.map(([v, l]) => <option key={l} value={v ?? ""}>{l}</option>)}
          </select>
        </label>
        <label>Date posted
          <select value={p.postedWithinDays ?? ""} onChange={(e) => setP({ ...p, postedWithinDays: e.target.value ? (Number(e.target.value) as Prefs["postedWithinDays"]) : null })}>
            {FRESH.map(([v, l]) => <option key={l} value={v ?? ""}>{l}</option>)}
          </select>
        </label>
      </>)}
      {err && <p className="alert error" role="alert">{err}</p>}
      <div className="row" style={{ marginTop: 16 }}>
        {step > 0 && <button type="button" className="btn secondary" onClick={() => setStep(step - 1)}>Back</button>}
        {step < STEPS.length - 1
          ? <button type="button" className="btn" onClick={() => setStep(step + 1)}>Continue</button>
          : <button type="button" className="btn" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save and see jobs"}</button>}
      </div>
    </section>
  );
}
