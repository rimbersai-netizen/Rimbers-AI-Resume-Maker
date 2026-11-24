"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { Email, Password, fieldErrors, safeNext, type FormState } from "@/lib/validation";

const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3100";

// Generic messages avoid revealing whether an account exists (no user enumeration).
const SIGN_IN_FAILED = "Email or password is incorrect, or the email is not verified yet.";
const CHECK_EMAIL = "Check your email for a link to continue.";

const echo = (form: FormData) => ({ email: String(form.get("email") ?? "").slice(0, 254) });

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const parsed = z.object({ email: Email, password: z.string().min(1, "Enter your password") }).safeParse({
    email: form.get("email"), password: form.get("password"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: echo(form) };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: error.status === 429 ? "Too many attempts. Please wait and try again." : SIGN_IN_FAILED, values: echo(form) };
  redirect(safeNext(form.get("next")));
}

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  const parsed = z.object({ email: Email, password: Password, terms: z.literal("on", { errorMap: () => ({ message: "Please accept the terms and privacy policy" }) }) })
    .safeParse({ email: form.get("email"), password: form.get("password"), terms: form.get("terms") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: echo(form) };
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
  if (error && /password/i.test(error.message)) return { fieldErrors: { password: error.message }, values: echo(form) };
  // Same response whether or not the email already exists: always continue to the code screen.
  redirect(`/verify?type=signup&email=${encodeURIComponent(parsed.data.email)}`);
}

const OTP_FAILED = "That code is incorrect or has expired. Check it and try again, or request a new one.";

/** Confirm a 6-digit email code (signup confirmation or passwordless sign-in). Generic errors; Supabase rate-limits attempts. */
export async function verifyOtp(_: FormState, form: FormData): Promise<FormState> {
  const parsed = z.object({ email: Email, token: z.string().regex(/^d{6}$/, "Enter the 6-digit code"), type: z.enum(["signup", "email"]) })
    .safeParse({ email: form.get("email"), token: String(form.get("token") ?? "").replace(/s/g, ""), type: form.get("type") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: echo(form) };
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email: parsed.data.email, token: parsed.data.token, type: parsed.data.type });
  if (error) return { error: error.status === 429 ? "Too many attempts. Please wait a minute and try again." : OTP_FAILED, values: echo(form) };
  redirect(safeNext(form.get("next")));
}

/** Send a fresh code. Same response whether or not the account exists. */
export async function resendOtp(_: FormState, form: FormData): Promise<FormState> {
  const parsed = z.object({ email: Email, type: z.enum(["signup", "email"]) }).safeParse({ email: form.get("email"), type: form.get("type") });
  if (!parsed.success) return { error: "Enter a valid email address." };
  const supabase = await createClient();
  const { error } = parsed.data.type === "signup"
    ? await supabase.auth.resend({ type: "signup", email: parsed.data.email })
    : await supabase.auth.signInWithOtp({ email: parsed.data.email, options: { shouldCreateUser: false } });
  if (error?.status === 429) return { error: "Please wait a minute before requesting another code.", values: echo(form) };
  return { message: "If that email can receive a code, a new one is on its way.", values: echo(form) };
}

/** Passwordless login step 1: email me a code. Never reveals whether the account exists. */
export async function requestLoginCode(_: FormState, form: FormData): Promise<FormState> {
  const parsed = Email.safeParse(form.get("email"));
  if (!parsed.success) return { fieldErrors: { email: parsed.error.issues[0]!.message }, values: echo(form) };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email: parsed.data, options: { shouldCreateUser: false } });
  if (error?.status === 429) return { error: "Too many attempts. Please wait a minute and try again.", values: echo(form) };
  redirect(`/verify?type=email&email=${encodeURIComponent(parsed.data)}&next=${encodeURIComponent(safeNext(form.get("next")))}`);
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
  if (!parsed.success) return { fieldErrors: { email: parsed.error.issues[0]!.message }, values: echo(form) };
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
  return { message: "Deletion requested. We will process it and permanently remove your account, resumes and files." };
}

/** Google sign-in via Supabase OAuth. The redirect target is built from the request host so it matches the allow-list entry (localhost vs 127.0.0.1). */
export async function signInWithGoogle(form: FormData): Promise<void> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") || host?.startsWith("127.") ? "http" : "https");
  const origin = host ? `${proto}://${host}` : site();
  const next = safeNext(form.get("next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` } });
  if (error || !data.url) redirect("/sign-in?error=google_unavailable");
  redirect(data.url);
}
