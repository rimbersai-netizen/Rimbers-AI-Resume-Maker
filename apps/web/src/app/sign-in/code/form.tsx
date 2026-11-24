"use client";
import { useActionState } from "react";
import { requestLoginCode } from "../../auth-actions";
import { Alerts, FieldError, Submit } from "../../form-bits";

export function CodeRequestForm({ next }: { next?: string }) {
  const [state, action] = useActionState(requestLoginCode, {});
  return (
    <form action={action} noValidate>
      <Alerts state={state} />
      <input type="hidden" name="next" value={next ?? "/dashboard"} />
      <label htmlFor="email">Email address</label>
      <input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} key={state.values?.email} aria-describedby="email-error" />
      <FieldError state={state} name="email" />
      <Submit>Email me a code</Submit>
    </form>
  );
}
