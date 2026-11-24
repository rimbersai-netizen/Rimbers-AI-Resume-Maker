import { listCountryRules } from "@gars/country-rules";
import { json, preflight } from "@/lib/api-auth";
import { flag, recommendationNotes } from "@/lib/resume-settings";

export const OPTIONS = preflight;

/** Country conventions are suggestions, not rules; the user can override every one. */
export function GET() {
  return json({
    countries: listCountryRules().map((r) => ({
      countryCode: r.countryCode, name: r.name, flag: flag(r.countryCode), documentName: r.documentName, pageSize: r.pageSize,
      suggestedResumeLocales: r.suggestedResumeLocales, typicalPages: r.typicalPages, notes: recommendationNotes(r.countryCode),
    })),
  });
}
