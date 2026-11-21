"use client";
import { useActionState } from "react";
import { updatePassword } from "../auth-actions";
import { Alerts, Brand, FieldError, Submit } from "../form-bits";

export default function ResetPasswordPage() {
  const [state, action] = useActionState(updatePassword, {});
  return (
    <main className="shell">
      <section className="card" aria-labelledby="t">
        <Brand />
        <h1 id="t">Choose a new password</h1>
        <form action={action} noValidate>
          <Alerts state={state} />
          <label htmlFor="password">New password</label>
          <input id="password" name="password" type="password" autoComplete="new-password" required />
          <FieldError state={state} name="password" />
          <label htmlFor="confirm">Confirm password</label>
          <input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
          <FieldError state={state} name="confirm" />
          <Submit>Update password</Submit>
        </form>
      </section>
    </main>
  );
}
