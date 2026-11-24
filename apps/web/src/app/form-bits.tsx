"use client";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/lib/validation";

export function Submit({ children, variant }: { children: React.ReactNode; variant?: "secondary" | "danger" }) {
  const { pending } = useFormStatus();
  return (
    <button className={`btn ${variant ?? ""}`} type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "Please wait…" : children}
    </button>
  );
}

export function FieldError({ state, name }: { state: FormState; name: string }) {
  const msg = state.fieldErrors?.[name];
  return msg ? <p className="field-error" id={`${name}-error`} role="alert">{msg}</p> : null;
}

export function Alerts({ state }: { state: FormState }) {
  return (
    <>
      {state.error && <div className="alert error" role="alert">{state.error}</div>}
      {state.message && <div className="alert ok" role="status">{state.message}</div>}
    </>
  );
}

export function Brand() {
  return <div className="brand"><span className="brand-r" aria-hidden>R</span>Rimbers <span className="brand-sub">AI Resume Maker</span></div>;
}
