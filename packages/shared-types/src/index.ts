/** Shared primitive types used across every package. Keep this dependency-free. */

export const BATCH_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "IMPLEMENTED",
  "VERIFIED",
  "BLOCKED",
  "FAILED",
] as const;
export type BatchStatus = (typeof BATCH_STATUSES)[number];

export const SUPPORTED_LOCALES = [
  "en", "ar", "ur", "fr", "de", "es", "it", "pt", "hi", "tr", "zh", "ja",
] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const RTL_LOCALES: readonly Locale[] = ["ar", "ur"];
export const isRtl = (locale: Locale): boolean => RTL_LOCALES.includes(locale);

/** ISO 3166-1 alpha-2 codes for the 30 launch countries. */
export const LAUNCH_COUNTRIES = [
  "SA", "AE", "QA", "KW", "BH", "OM",
  "US", "CA", "GB", "DE", "FR", "IT", "ES", "NL", "CH",
  "SE", "NO", "DK", "FI", "IE", "AU", "NZ",
  "IN", "PK", "BD", "PH", "SG", "MY", "JP", "KR",
] as const;
export type LaunchCountry = (typeof LAUNCH_COUNTRIES)[number];

export const PLAN_IDS = ["FREE", "STANDARD", "PROFESSIONAL", "PREMIUM"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
