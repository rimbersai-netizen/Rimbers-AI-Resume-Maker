"use client";
import { useActionState } from "react";
import { signUp } from "../auth-actions";
import { Alerts, FieldError, Submit } from "../form-bits";

export function SignUpForm() {
  const [state, action] = useActionState(signUp, {});
  return (
    <form action={action} noValidate>
      <Alerts state={state} />
      <label htmlFor="email">Email address</label>
      <input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} key={state.values?.email} aria-describedby="email-error" />
      <FieldError state={state} name="email" />
      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" autoComplete="new-password" required aria-describedby="password-error password-hint" />
      <p className="muted" id="password-hint">At least 10 characters with upper- and lowercase letters and a number.</p>
      <FieldError state={state} name="password" />
      <label className="check"><input type="checkbox" name="terms" /> <span>I agree to the Terms and Privacy Policy</span></label>
      <FieldError state={state} name="terms" />
      <Submit>Create account</Submit>
    </form>
  );
}
