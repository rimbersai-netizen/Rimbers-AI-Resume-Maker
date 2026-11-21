/**
 * App-language resolution — implements docs/localization/GLOBAL_LANGUAGE_STRATEGY.md.
 * Pure functions: platform code supplies device locales + storage; this decides.
 */
import { SUPPORTED_LOCALES, type Locale } from "@gars/shared-types";

export const DEFAULT_LOCALE: Locale = "en";

export type LocaleSource = "manual" | "device" | "country" | "default";
export interface SavedLocale {
  locale: string;
  source: LocaleSource;
}

const SUPPORTED = new Set<string>(SUPPORTED_LOCALES);

/** Normalise "pt_BR", "PT-br", "zh-Hans-CN" → BCP 47-ish lower-case language + original subtags. */
export function normalizeTag(tag: string): string {
  const parts = tag.trim().replace(/_/g, "-").split("-").filter(Boolean);
  if (parts.length === 0) return "";
  const [lang, ...rest] = parts;
  return [lang!.toLowerCase(), ...rest.map((p) => (p.length === 2 ? p.toUpperCase() : p.length === 4 ? p[0]!.toUpperCase() + p.slice(1).toLowerCase() : p))].join("-");
}

/** Map any tag to a supported app locale, or undefined. Region/script variants map to their base catalog. */
export function matchSupported(tag: string): Locale | undefined {
  const n = normalizeTag(tag);
  if (!n) return undefined;
  if (SUPPORTED.has(n)) return n as Locale;
  const base = n.split("-")[0]!;
  // Norwegian/Chinese aliases could be added here as catalogs grow.
  return SUPPORTED.has(base) ? (base as Locale) : undefined;
}

/**
 * Primary APP language suggestion by country — used ONLY when the device gives no language at all.
 * Countries with many languages (IN, CH, CA, SG, MY, PH…) are deliberately absent → English.
 */
const COUNTRY_APP_LANGUAGE: Readonly<Record<string, Locale>> = {
  SA: "ar", AE: "ar", QA: "ar", KW: "ar", BH: "ar", OM: "ar", EG: "ar", JO: "ar",
  PK: "ur", DE: "de", AT: "de", FR: "fr", ES: "es", MX: "es", IT: "it",
  PT: "pt", BR: "pt", TR: "tr", CN: "zh", JP: "ja",
};

export interface ResolveInput {
  /** What persistent storage holds, if anything. */
  saved?: SavedLocale | null;
  /** Device/browser preferred languages in order (navigator.languages / expo-localization). */
  deviceLocales: readonly string[];
  /** User-selected (or detected) country, if known. */
  countryCode?: string | null;
}

export interface ResolveResult {
  locale: Locale;
  source: LocaleSource;
  /** True if the caller should persist the result (it differs from what was saved). */
  changed: boolean;
}

/**
 * Priority: 1 saved manual choice → 2 supported device language → 3 country suggestion
 * (only when the device reports no language) → 4 English.
 * A manual choice is never replaced. Non-manual values follow the device so a phone language
 * change is picked up; if the device language is unsupported we keep the earlier automatic value
 * rather than flip-flopping.
 */
export function resolveAppLocale(input: ResolveInput): ResolveResult {
  const saved = input.saved ?? null;
  const savedLocale = saved ? matchSupported(saved.locale) : undefined;

  if (saved?.source === "manual" && savedLocale) {
    return { locale: savedLocale, source: "manual", changed: savedLocale !== saved.locale };
  }

  const finish = (locale: Locale, source: LocaleSource): ResolveResult => ({
    locale,
    source,
    changed: !saved || saved.locale !== locale || saved.source !== source,
  });

  for (const tag of input.deviceLocales) {
    const m = matchSupported(tag);
    if (m) return finish(m, "device");
  }

  if (saved && savedLocale) return { locale: savedLocale, source: saved.source, changed: false };

  if (input.deviceLocales.length === 0 && input.countryCode) {
    const c = COUNTRY_APP_LANGUAGE[input.countryCode.toUpperCase()];
    if (c) return finish(c, "country");
  }

  return finish(DEFAULT_LOCALE, "default");
}

/** The user picked a language explicitly. Always persisted as manual. */
export function chooseLocaleManually(tag: string): SavedLocale {
  const m = matchSupported(tag);
  if (!m) throw new Error(`Unsupported locale: ${tag}`);
  return { locale: m, source: "manual" };
}

/** Guest → account merge: a manual choice wins; otherwise the account value is kept. */
export function mergeSavedLocales(guest: SavedLocale | null, account: SavedLocale | null): SavedLocale | null {
  if (account?.source === "manual") return account;
  if (guest?.source === "manual") return guest;
  return account ?? guest;
}

const RTL_LANGS = new Set(["ar", "ur", "fa", "he", "ps", "sd", "ug", "yi", "dv", "ckb"]);
export function isRtlLocale(tag: string): boolean {
  return RTL_LANGS.has(normalizeTag(tag).split("-")[0] ?? "");
}
export function textDirection(tag: string): "rtl" | "ltr" {
  return isRtlLocale(tag) ? "rtl" : "ltr";
}
