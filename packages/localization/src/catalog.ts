/**
 * Message catalogs with per-key English fallback. Missing keys NEVER render blank or as raw keys
 * in production: they fall back to English. Coverage + translation status are reported honestly.
 */
import type { Locale } from "@gars/shared-types";
import en from "./catalogs/en.json";
import ar from "./catalogs/ar.json";

export type TranslationStatus = "source" | "machine" | "reviewed" | "verified";

export interface Catalog {
  locale: Locale;
  status: TranslationStatus;
  messages: Readonly<Record<string, string>>;
}

export type MessageKey = keyof typeof en.messages;

const CATALOGS = new Map<string, Catalog>([
  ["en", en as Catalog],
  ["ar", ar as Catalog],
]);

export function registerCatalog(c: Catalog): void {
  CATALOGS.set(c.locale, c);
}

const EN = (): Catalog => CATALOGS.get("en")!;

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

export interface TranslateResult {
  text: string;
  /** Locale the text actually came from (differs from requested when falling back). */
  from: string;
}

export function translate(locale: string, key: string, params?: Record<string, string | number>): TranslateResult {
  const own = CATALOGS.get(locale)?.messages[key];
  if (own !== undefined && own !== "") return { text: interpolate(own, params), from: locale };
  const fallback = EN().messages[key];
  if (fallback !== undefined) return { text: interpolate(fallback, params), from: "en" };
  // Unknown key even in English: surface the key so tests catch it, never an empty string.
  return { text: key, from: "missing" };
}

export function t(locale: string, key: MessageKey, params?: Record<string, string | number>): string {
  return translate(locale, key, params).text;
}

export interface CoverageReport {
  locale: string;
  status: TranslationStatus | "absent";
  translated: number;
  total: number;
  percent: number;
  missing: string[];
  /** Keys whose {placeholders} differ from English — a correctness bug. */
  placeholderMismatches: string[];
  /** Shown as fully supported only at 100% coverage AND reviewed or verified. */
  fullySupported: boolean;
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

export function coverage(locale: string): CoverageReport {
  const enMsgs = EN().messages;
  const keys = Object.keys(enMsgs);
  const c = CATALOGS.get(locale);
  const msgs = c?.messages ?? {};
  const missing = keys.filter((k) => !msgs[k]);
  const placeholderMismatches = keys.filter((k) => msgs[k] && placeholders(msgs[k]!) !== placeholders(enMsgs[k]!));
  const translated = keys.length - missing.length;
  const percent = keys.length ? Math.floor((translated / keys.length) * 100) : 100;
  return {
    locale,
    status: c?.status ?? "absent",
    translated,
    total: keys.length,
    percent,
    missing,
    placeholderMismatches,
    fullySupported: percent === 100 && placeholderMismatches.length === 0 && (c?.status === "reviewed" || c?.status === "verified" || c?.status === "source"),
  };
}
