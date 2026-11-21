"use client";
import { useActionState } from "react";
import { requestAccountDeletion } from "../auth-actions";
import { Alerts, FieldError, Submit } from "../form-bits";

export function DeletionForm() {
  const [state, action] = useActionState(requestAccountDeletion, {});
  return (
    <form action={action} noValidate>
      <Alerts state={state} />
      <label htmlFor="reason">Reason (optional)</label>
      <textarea id="reason" name="reason" rows={2} maxLength={1000} />
      <label htmlFor="confirm">Type DELETE to confirm</label>
      <input id="confirm" name="confirm" type="text" autoComplete="off" />
      <FieldError state={state} name="confirm" />
      <Submit variant="danger">Request account deletion</Submit>
    </form>
  );
}
