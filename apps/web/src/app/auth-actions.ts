"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { Email, Password, fieldErrors, safeNext, type FormState } from "@/lib/validation";

const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3100";

// Generic messages avoid revealing whether an account exists (no user enumeration).
const SIGN_IN_FAILED = "Email or password is incorrect, or the email is not verified yet.";
const CHECK_EMAIL = "Check your email for a link to continue.";

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const parsed = z.object({ email: Email, password: z.string().min(1, "Enter your password") }).safeParse({
    email: form.get("email"), password: form.get("password"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: error.status === 429 ? "Too many attempts. Please wait and try again." : SIGN_IN_FAILED };
  redirect(safeNext(form.get("next")));
}

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  const parsed = z.object({ email: Email, password: Password, terms: z.literal("on", { errorMap: () => ({ message: "Please accept the terms and privacy policy" }) }) })
    .safeParse({ email: form.get("email"), password: form.get("password"), terms: form.get("terms") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Guest → account: upgrading the anonymous user keeps all their drafts (same user id).
  if (user?.is_anonymous) {
    const { error } = await supabase.auth.updateUser(
      { email: parsed.data.email, password: parsed.data.password },
      { emailRedirectTo: `${site()}/auth/confirm?next=/dashboard` },
    );
    if (error) return { error: error.status === 429 ? "Too many attempts. Please wait and try again." : "Could not create the account. Try a different email." };
    return { message: CHECK_EMAIL };
  }

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: `${site()}/auth/confirm?next=/dashboard` },
  });
  if (error && error.status === 429) return { error: "Too many attempts. Please wait and try again." };
  if (error && /password/i.test(error.message)) return { fieldErrors: { password: error.message } };
  // Same response whether or not the email already exists.
  return { message: CHECK_EMAIL };
}

export async function continueAsGuest(): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) redirect("/sign-in?error=guest_unavailable");
  }
  redirect("/dashboard");
}

export async function requestPasswordReset(_: FormState, form: FormData): Promise<FormState> {
  const parsed = Email.safeParse(form.get("email"));
  if (!parsed.success) return { fieldErrors: { email: parsed.error.issues[0]!.message } };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, { redirectTo: `${site()}/auth/confirm?next=/reset-password` });
  if (error?.status === 429) return { error: "Too many attempts. Please wait and try again." };
  return { message: "If an account exists for that email, we sent a reset link." };
}

export async function updatePassword(_: FormState, form: FormData): Promise<FormState> {
  const parsed = z.object({ password: Password, confirm: z.string() }).refine((v) => v.password === v.confirm, { message: "Passwords do not match", path: ["confirm"] })
    .safeParse({ password: form.get("password"), confirm: form.get("confirm") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your reset link has expired. Request a new one." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "Could not update the password. Try a different one." };
  redirect("/dashboard?password=updated");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}

export async function requestAccountDeletion(_: FormState, form: FormData): Promise<FormState> {
  if (form.get("confirm") !== "DELETE") return { fieldErrors: { confirm: "Type DELETE to confirm" } };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in again." };
  const reason = String(form.get("reason") ?? "").slice(0, 1000) || null;
  const { error } = await supabase.from("deletion_requests").insert({ user_id: user.id, reason });
  if (error?.code === "23505") return { message: "A deletion request is already being processed." };
  if (error) return { error: "Could not submit the request. Please try again." };
  await supabase.rpc("write_audit_log", { p_action: "account.deletion_requested", p_entity_type: "user", p_entity_id: user.id, p_metadata: {} });
  return { message: "Deletion requested. Your account and data will be removed; you will receive a confirmation email." };
}
