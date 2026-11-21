"use client";
import { useId } from "react";

interface Base { label: string; error?: string; required?: boolean; hint?: string; onBlur?: () => void }

export function TextField(p: Base & { value?: string; onChange: (v: string) => void; type?: string; maxLength?: number; autoComplete?: string; placeholder?: string; dir?: "ltr" | "auto"; counter?: boolean }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{p.label}{p.required && <span aria-hidden> *</span>}</label>
      <input id={id} type={p.type ?? "text"} value={p.value ?? ""} maxLength={p.maxLength} autoComplete={p.autoComplete} placeholder={p.placeholder}
        dir={p.dir} aria-invalid={Boolean(p.error)} aria-required={p.required} aria-describedby={p.error ? `${id}-e` : p.hint ? `${id}-h` : undefined}
        onChange={(e) => p.onChange(e.target.value)} onBlur={p.onBlur} />
      {p.counter && p.maxLength && <span className="counter">{(p.value ?? "").length} / {p.maxLength}</span>}
      {p.hint && !p.error && <p className="muted small" id={`${id}-h`}>{p.hint}</p>}
      {p.error && <p className="field-error" id={`${id}-e`}>{p.error}</p>}
    </div>
  );
}

export function TextArea(p: Base & { value?: string; onChange: (v: string) => void; maxLength: number; rows?: number; placeholder?: string }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{p.label}{p.required && <span aria-hidden> *</span>}</label>
      <textarea id={id} rows={p.rows ?? 4} value={p.value ?? ""} maxLength={p.maxLength} placeholder={p.placeholder} aria-invalid={Boolean(p.error)}
        aria-describedby={p.error ? `${id}-e` : undefined} onChange={(e) => p.onChange(e.target.value)} onBlur={p.onBlur} />
      <span className="counter">{(p.value ?? "").length} / {p.maxLength}</span>
      {p.error && <p className="field-error" id={`${id}-e`}>{p.error}</p>}
    </div>
  );
}

export function Select<T extends string>(p: Base & { value?: T; onChange: (v: T | undefined) => void; options: { value: T; label: string }[]; placeholder?: string }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{p.label}{p.required && <span aria-hidden> *</span>}</label>
      <select id={id} value={p.value ?? ""} aria-invalid={Boolean(p.error)} onChange={(e) => p.onChange((e.target.value || undefined) as T | undefined)} onBlur={p.onBlur}>
        <option value="">{p.placeholder ?? "Select…"}</option>
        {p.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {p.error && <p className="field-error">{p.error}</p>}
    </div>
  );
}

/** Month picker producing YYYY-MM (matches the schema's partial dates). */
export function MonthField(p: Base & { value?: string; onChange: (v: string | undefined) => void; disabled?: boolean }) {
  const id = useId();
  const v = p.value && /^\d{4}$/.test(p.value) ? `${p.value}-01` : p.value?.slice(0, 7);
  return (
    <div className="field">
      <label htmlFor={id}>{p.label}{p.required && <span aria-hidden> *</span>}</label>
      <input id={id} type="month" value={v ?? ""} disabled={p.disabled} aria-invalid={Boolean(p.error)} min="1950-01" max="2100-12"
        onChange={(e) => p.onChange(e.target.value || undefined)} onBlur={p.onBlur} />
      {p.error && <p className="field-error">{p.error}</p>}
    </div>
  );
}

export function Checkbox(p: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <label className="check"><input type="checkbox" checked={p.checked} onChange={(e) => p.onChange(e.target.checked)} /> <span>{p.label}</span></label>;
}
