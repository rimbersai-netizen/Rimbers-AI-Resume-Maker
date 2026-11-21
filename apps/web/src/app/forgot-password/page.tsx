"use client";
import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "../auth-actions";
import { Alerts, Brand, FieldError, Submit } from "../form-bits";

export default function ForgotPasswordPage() {
  const [state, action] = useActionState(requestPasswordReset, {});
  return (
    <main className="shell">
      <section className="card" aria-labelledby="t">
        <Brand />
        <h1 id="t">Reset your password</h1>
        <p className="sub">We’ll email you a secure link.</p>
        <form action={action} noValidate>
          <Alerts state={state} />
          <label htmlFor="email">Email address</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
          <FieldError state={state} name="email" />
          <Submit>Send reset link</Submit>
        </form>
        <p className="row muted"><Link href="/sign-in">Back to sign in</Link></p>
      </section>
    </main>
  );
}
