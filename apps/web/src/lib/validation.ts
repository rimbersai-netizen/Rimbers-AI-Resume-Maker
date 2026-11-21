import { z } from "zod";

export const Email = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);
/** Mirrors supabase/config.toml: ≥10 chars with lower, upper and digit. */
export const Password = z.string()
  .min(10, "Use at least 10 characters")
  .max(128)
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/\d/, "Include a number");

/** Only allow same-site relative redirects (prevents open redirects via ?next=). */
export function safeNext(next: unknown, fallback = "/dashboard"): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}

export type FormState = { error?: string; fieldErrors?: Record<string, string>; message?: string };

export function fieldErrors(e: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of e.issues) out[i.path.join(".")] ??= i.message;
  return out;
}
