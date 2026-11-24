"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { resendOtp, verifyOtp } from "../auth-actions";
import { Alerts, FieldError, Submit } from "../form-bits";

/** One field for the 6-digit code (works with SMS/email autofill), plus resend with a 60-second cooldown. */
export function VerifyForm({ email, type, next }: { email: string; type: "signup" | "email"; next: string }) {
  const [state, action] = useActionState(verifyOtp, {});
  const [resent, resend] = useActionState(resendOtp, {});
  const [wait, setWait] = useState(60);
  const [code, setCode] = useState("");
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);
  useEffect(() => { if (resent.message) setWait(60); }, [resent]);

  return (
    <>
      <form ref={form} action={action} noValidate>
        <Alerts state={state} />
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="next" value={next} />
        {!email && (<><label htmlFor="v-email">Email address</label><input id="v-email" name="email" type="email" autoComplete="email" required /></>)}
        <label htmlFor="token">6-digit code</label>
        <input
          id="token" name="token" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} required autoFocus
          value={code} onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 6); setCode(v); if (v.length === 6) setTimeout(() => form.current?.requestSubmit(), 50); }}
          aria-describedby="token-error" style={{ fontSize: "1.8rem", letterSpacing: "0.5em", textAlign: "center", fontVariantNumeric: "tabular-nums" }}
        />
        <FieldError state={state} name="token" />
        <Submit>{type === "signup" ? "Confirm and continue" : "Sign in"}</Submit>
      </form>
      <form action={resend} className="row" style={{ justifyContent: "center", marginTop: 8 }}>
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="type" value={type} />
        <button type="submit" className="link" disabled={wait > 0 || !email}>{wait > 0 ? `Send a new code in ${wait}s` : "Send a new code"}</button>
      </form>
      <p role="status" aria-live="polite" className={resent.error ? "field-error" : "muted small"} style={{ textAlign: "center" }}>{resent.error ?? resent.message}</p>
    </>
  );
}
