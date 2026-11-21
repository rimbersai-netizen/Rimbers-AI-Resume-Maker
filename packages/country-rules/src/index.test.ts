import { describe, expect, it } from "vitest";
import { LAUNCH_COUNTRIES } from "@gars/shared-types";
import { CountryRule, formatResumeDate, getCountryRule, listCountryRules, recommendResumeSettings } from "./index";

describe("country rule data", () => {
  it("covers all 30 launch countries", () => {
    const codes = listCountryRules().map((r) => r.countryCode).sort();
    expect(codes).toEqual([...LAUNCH_COUNTRIES].sort());
  });

  it.each(listCountryRules().map((r) => [r.countryCode, r] as const))("%s validates and has sources + review date", (_c, rule) => {
    expect(CountryRule.safeParse(rule).success).toBe(true);
    expect(rule.sources.length).toBeGreaterThan(0);
    expect(rule.lastReviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("does not claim expert review for compiled data", () => {
    expect(listCountryRules().every((r) => r.reviewStatus !== "expert_reviewed")).toBe(true);
  });

  it("section orders have no duplicates", () => {
    for (const r of listCountryRules()) expect(new Set(r.sectionOrder).size).toBe(r.sectionOrder.length);
  });

  it("presets are not shared by reference (mutating one rule cannot leak)", () => {
    expect(getCountryRule("SA")!.personalInfo).not.toBe(getCountryRule("AE")!.personalInfo);
  });

  it("key conventions", () => {
    expect(getCountryRule("US")).toMatchObject({ pageSize: "Letter", photo: "omit", documentName: "resume" });
    expect(getCountryRule("GB")).toMatchObject({ pageSize: "A4", photo: "omit" });
    expect(getCountryRule("DE")).toMatchObject({ pageSize: "A4", dateFormat: "MM.YYYY", photo: "common" });
    expect(getCountryRule("JP")?.photo).toBe("expected");
    expect(getCountryRule("sa")?.suggestedResumeLocales).toEqual(["en", "ar"]);
  });
});

describe("recommendResumeSettings", () => {
  it("SA + English user → English resume by default, Arabic offered (country never forces language)", () => {
    const r = recommendResumeSettings("SA", { preferredLocale: "en" });
    expect(r.resumeLocale).toBe("en");
    expect(r.suggestedResumeLocales).toContain("ar");
  });

  it("PK + English user → English resume, not Urdu", () => {
    expect(recommendResumeSettings("PK", { preferredLocale: "en-GB" }).resumeLocale).toBe("en");
  });

  it("DE + German user → German resume; DE + Arabic user → falls back to country's first language", () => {
    expect(recommendResumeSettings("DE", { preferredLocale: "de-AT" }).resumeLocale).toBe("de");
    expect(recommendResumeSettings("DE", { preferredLocale: "ar" }).resumeLocale).toBe("de");
  });

  it("photo defaults on only when common/expected AND the user has a photo", () => {
    expect(recommendResumeSettings("DE", { hasPhoto: true }).includePhoto).toBe(true);
    expect(recommendResumeSettings("DE", { hasPhoto: false }).includePhoto).toBe(false);
    expect(recommendResumeSettings("US", { hasPhoto: true }).includePhoto).toBe(false);
  });

  it("US does not offer age/marital/gender fields", () => {
    const f = recommendResumeSettings("US").offeredPersonalFields;
    expect(f).not.toContain("dateOfBirth");
    expect(f).not.toContain("maritalStatus");
    expect(f).toContain("visaOrWorkStatus");
  });

  it("user overrides win and are reported", () => {
    const r = recommendResumeSettings("US", {
      overrides: { pageSize: "A4", includePhoto: true, resumeLocale: "es", sectionOrder: ["education", "experience"] },
    });
    expect(r).toMatchObject({ pageSize: "A4", includePhoto: true, resumeLocale: "es", sectionOrder: ["education", "experience"] });
    expect(r.overridden.sort()).toEqual(["includePhoto", "pageSize", "resumeLocale", "sectionOrder"]);
  });

  it("unknown country falls back to international defaults", () => {
    const r = recommendResumeSettings("BR");
    expect(r).toMatchObject({ isFallback: true, countryCode: "BR", pageSize: "A4", resumeLocale: "en" });
  });

  it("returns copies, not shared state", () => {
    const a = recommendResumeSettings("US");
    a.sectionOrder.pop();
    expect(recommendResumeSettings("US").sectionOrder.length).toBe(getCountryRule("US")!.sectionOrder.length);
  });
});

describe("formatResumeDate", () => {
  it.each([
    ["2024-03", "MM/YYYY", "03/2024"],
    ["2024-03", "MM.YYYY", "03.2024"],
    ["2024-03", "MMM YYYY", "Mar 2024"],
    ["2024-03", "YYYY年MM月", "2024年3月"],
    ["2024-03-15", "YYYY.MM", "2024.03"],
    ["2024", "MM/YYYY", "2024"],
    ["2024", "YYYY年MM月", "2024年"],
  ] as const)("%s as %s → %s", (d, f, out) => expect(formatResumeDate(d, f)).toBe(out));
});
