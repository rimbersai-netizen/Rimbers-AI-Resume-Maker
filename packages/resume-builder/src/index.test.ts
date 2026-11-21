import { describe, expect, it } from "vitest";
import { MasterProfile } from "@gars/resume-schema";
import { renderResumeHtml, getTemplate } from "@gars/template-engine";
import { changeCountry, defaultLayout, flag, isPremiumTemplate, override, overrideSections, recommendationNotes, toResumeDocument } from "./index";

const profile = MasterProfile.parse({
  schemaVersion: 1, personal: { fullName: "Ayesha Khan", email: "a@example.com" }, summary: "Engineer.",
  experience: [{ id: "w1", employer: "Tech", title: "Engineer", dates: { start: "2021-03", current: true }, bullets: [] }],
  skills: [{ id: "s1", name: "React" }],
});

describe("defaultLayout", () => {
  it("US: Letter, no photo, ATS-friendly free template, English", () => {
    const l = defaultLayout("US", "en", { hasPhoto: true });
    expect(l).toMatchObject({ countryCode: "US", pageSize: "Letter", includePhoto: false, locale: "en" });
    expect(getTemplate(l.templateId)?.category).toBe("ats_minimal");
    expect(isPremiumTemplate(l.templateId)).toBe(false);
  });
  it("SA with English app → English resume (country never forces Arabic)", () =>
    expect(defaultLayout("SA", "en").locale).toBe("en"));
  it("SA with Arabic app → Arabic resume", () => expect(defaultLayout("SA", "ar").locale).toBe("ar"));
  it("DE with German app: A4, photo on only if the user has one", () => {
    expect(defaultLayout("DE", "de", { hasPhoto: true })).toMatchObject({ pageSize: "A4", includePhoto: true, locale: "de" });
    expect(defaultLayout("DE", "de", { hasPhoto: false }).includePhoto).toBe(false);
  });
  it("includes all sections, country order first", () => {
    const l = defaultLayout("JP", "ja");
    expect(l.sections[1]!.key).toBe("education");
    expect(l.sections).toHaveLength(12);
  });
});

describe("overrides survive country changes", () => {
  it("non-overridden fields follow the new country", () => {
    // Germany accepts English resumes, so an English-speaking user keeps English (country never forces language)…
    expect(changeCountry(defaultLayout("US", "en"), "DE", "en")).toMatchObject({ countryCode: "DE", pageSize: "A4", locale: "en" });
    // …but if the user's language isn't accepted there, the country's first language is suggested.
    expect(changeCountry(defaultLayout("US", "ar"), "DE", "ar")).toMatchObject({ countryCode: "DE", locale: "de" });
  });
  it("overridden fields are kept", () => {
    let l = defaultLayout("US", "en");
    l = override(l, "locale", "en");
    l = override(l, "pageSize", "Letter");
    l = changeCountry(l, "DE", "en");
    expect(l).toMatchObject({ countryCode: "DE", locale: "en", pageSize: "Letter" });
    expect(l.settings.overridden.sort()).toEqual(["locale", "pageSize"]);
  });
  it("custom section order is kept across country change", () => {
    let l = defaultLayout("US", "en");
    l = overrideSections(l, [...l.sections].reverse());
    const before = l.sections.map((s) => s.key);
    expect(changeCountry(l, "JP", "en").sections.map((s) => s.key)).toEqual(before);
  });
  it("override does not duplicate entries", () => {
    const l = override(override(defaultLayout("US", "en"), "pageSize", "A4"), "pageSize", "Letter");
    expect(l.settings.overridden).toEqual(["pageSize"]);
  });
});

describe("toResumeDocument + render", () => {
  it("hidden sections are excluded from the document", () => {
    let l = defaultLayout("US", "en");
    l = overrideSections(l, l.sections.map((s) => (s.key === "skills" ? { ...s, visible: false } : s)));
    const doc = toResumeDocument("r1", l, profile);
    expect(doc.sectionOrder).not.toContain("skills");
    const html = renderResumeHtml(doc, getTemplate(l.templateId)!);
    expect(html).not.toContain(">Skills</h2>");
    expect(html).toContain("Ayesha Khan");
  });
  it("Arabic resume layout renders RTL even when the app is English", () => {
    const l = override(defaultLayout("SA", "en"), "locale", "ar");
    const html = renderResumeHtml(toResumeDocument("r1", l, profile), getTemplate(l.templateId)!);
    expect(html).toMatch(/dir="rtl"/);
  });
  it("DE date convention flows to preview", () => {
    const l = defaultLayout("DE", "de");
    expect(renderResumeHtml(toResumeDocument("r1", l, profile), getTemplate(l.templateId)!)).toContain("03.2021");
  });
});

describe("summary override", () => {
  it("tailored summary applies to this resume only; the master profile object is untouched", () => {
    const l = { ...defaultLayout("US", "en"), settings: { ...defaultLayout("US", "en").settings, summaryOverride: "Tailored for ACME." } };
    const doc = toResumeDocument("r1", l, profile);
    expect(doc.profile.summary).toBe("Tailored for ACME.");
    expect(profile.summary).toBe("Engineer.");
    expect(toResumeDocument("r1", defaultLayout("US", "en"), profile).profile.summary).toBe("Engineer.");
  });
});

describe("helpers", () => {
  it("flag emoji", () => expect(flag("sa")).toBe("🇸🇦"));
  it("notes describe conventions, not rules", () => {
    expect(recommendationNotes("US").join(" ")).toMatch(/usually left out/);
    expect(recommendationNotes("BR")[0]).toMatch(/international defaults/);
  });
});
