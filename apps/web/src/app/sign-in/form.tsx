"use client";
import { useActionState } from "react";
import Link from "next/link";
import { signIn } from "../auth-actions";
import { Alerts, FieldError, Submit } from "../form-bits";

export function SignInForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signIn, {});
  return (
    <form action={action} noValidate>
      <Alerts state={state} />
      <input type="hidden" name="next" value={next ?? "/dashboard"} />
      <label htmlFor="email">Email address</label>
      <input id="email" name="email" type="email" autoComplete="email" required aria-describedby="email-error" />
      <FieldError state={state} name="email" />
      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required aria-describedby="password-error" />
      <FieldError state={state} name="password" />
      <div className="row"><span /><Link href="/forgot-password">Forgot password?</Link></div>
      <Submit>Sign in</Submit>
    </form>
  );
}
