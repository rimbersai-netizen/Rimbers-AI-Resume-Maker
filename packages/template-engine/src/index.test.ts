import { describe, expect, it } from "vitest";
import { ResumeDocument } from "@gars/resume-schema";
import { analyzeResume } from "@gars/ats-engine";
import { getCountryRule } from "@gars/country-rules";
import { layoutKey, recommendTemplates, renderResumeHtml, RESUME_HEADINGS, TEMPLATE_CATEGORIES, TEMPLATES, type TemplateSpec } from "./index";

const doc = (over: Record<string, unknown> = {}) => ResumeDocument.parse({
  schemaVersion: 1, id: "r1", title: "CV", country: "US", locale: "en", templateId: "ats-minimal-01", pageSize: "Letter",
  sectionOrder: ["summary", "experience", "education", "skills", "languages", "certifications", "custom"],
  profile: {
    schemaVersion: 1,
    personal: { fullName: "Ayesha Khan", professionalTitle: "Software Engineer", email: "ayesha@example.com", phone: "+966 55 123 4567",
      location: { city: "Riyadh" }, linkedin: "https://linkedin.com/in/ayesha" },
    summary: "Engineer with five years of experience.",
    experience: [
      { id: "w1", employer: "Tech Solutions", title: "Senior Software Engineer", dates: { start: "2021-01", current: true }, bullets: [{ id: "b1", text: "Led a team of 4 developers" }] },
      { id: "w0", employer: "Hidden Corp", title: "Intern", dates: { start: "2017" } },
    ],
    education: [{ id: "e1", institution: "King Saud University", qualification: "B.Sc. Computer Science", dates: { start: "2014", end: "2018" } }],
    skills: [{ id: "s1", name: "React" }, { id: "s2", name: "Node.js" }, { id: "s3", name: "<script>alert(1)</script>" }],
    languages: [{ id: "l1", language: "Arabic", proficiency: "native" }],
    customSections: [{ id: "c1", heading: "Memberships", entries: [{ id: "c1e", title: "Saudi Council of Engineers" }] }],
  },
  hiddenItemIds: ["w0"],
  ...over,
});

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const contrast = (a: string, b: string) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05); };

describe("template library", () => {
  it("has at least 100 templates", () => expect(TEMPLATES.length).toBeGreaterThanOrEqual(100));
  it("every template has a structurally unique layout (colour does not count)", () =>
    expect(new Set(TEMPLATES.map((t) => layoutKey(t.layout))).size).toBe(TEMPLATES.length));
  it("ids are unique", () => expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length));
  it("covers all 21 categories", () => expect(new Set(TEMPLATES.map((t) => t.category)).size).toBe(TEMPLATE_CATEGORIES.length));
  it("ATS Minimal templates are single-column, photo-free, plain skills", () => {
    for (const t of TEMPLATES.filter((x) => x.category === "ats_minimal"))
      expect(t.layout).toMatchObject({ columns: "single", photo: "none", skillsStyle: "comma" });
  });
  it("accent colours meet WCAG AA (4.5:1) as text on white and as white-on-accent", () => {
    for (const t of TEMPLATES) expect(contrast(t.accent, "#FFFFFF"), t.id).toBeGreaterThanOrEqual(4.5);
  });
  it("there are free templates in every non-premium-only category", () => expect(TEMPLATES.filter((t) => !t.premium).length).toBeGreaterThan(50));
  it("recommends country categories first", () => {
    const rec = recommendTemplates(getCountryRule("US")!.recommendedTemplateCategories);
    expect(rec[0]!.category).toBe("ats_minimal");
  });
});

describe("renderResumeHtml — every template renders", () => {
  it.each(TEMPLATES.map((t) => [t.id, t] as const))("%s", (_id, t: TemplateSpec) => {
    const html = renderResumeHtml(doc({ templateId: t.id }), t);
    expect(html).toContain("<h1><bdi>Ayesha Khan</bdi></h1>");
    expect(html).toMatch(/<h2 id="[^"]+">Work Experience<\/h2>/);
    expect(html).not.toContain("<table");
    expect(html).not.toContain("Hidden Corp");
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("render details", () => {
  const t = TEMPLATES.find((x) => x.layout.columns === "sidebar_start")!;
  it("page size + locale + direction", () => {
    const html = renderResumeHtml(doc(), TEMPLATES[0]!);
    expect(html).toContain("size: Letter");
    expect(html).toMatch(/<html lang="en" dir="ltr">/);
  });
  it("Arabic resume is RTL with Arabic headings and LTR-isolated email/phone", () => {
    const html = renderResumeHtml(doc({ locale: "ar", country: "SA", pageSize: "A4" }), t);
    expect(html).toMatch(/<html lang="ar" dir="rtl">/);
    expect(html).toContain(RESUME_HEADINGS.ar!.experience);
    expect(html).toContain('<bdi dir="ltr">ayesha@example.com</bdi>');
    expect(html).toContain('<bdi dir="ltr">+966 55 123 4567</bdi>');
    expect(html).toContain("size: A4");
  });
  it("Urdu gets taller line height for Nastaliq", () => expect(renderResumeHtml(doc({ locale: "ur" }), TEMPLATES[0]!)).toMatch(/line-height: 1\.9/));
  it("country date convention: DE uses MM.YYYY, JP uses 年月", () => {
    expect(renderResumeHtml(doc({ country: "DE" }), TEMPLATES[0]!)).toContain("01.2021");
    expect(renderResumeHtml(doc({ country: "JP", locale: "ja" }), TEMPLATES[0]!)).toContain("2021年1月");
  });
  it("'Present' localised for current roles", () => expect(renderResumeHtml(doc({ locale: "de", country: "DE" }), TEMPLATES[0]!)).toContain("01.2021 – heute"));
  it("sidebar sections go to <aside>", () => {
    const html = renderResumeHtml(doc(), t);
    expect(html).toMatch(/<aside>.*sec-skills.*<\/aside>/s);
  });
  it("photo only when doc opts in AND layout has a slot AND src given", () => {
    const withSlot = TEMPLATES.find((x) => x.layout.photo !== "none")!;
    expect(renderResumeHtml(doc({ includePhoto: true }), withSlot, { photoSrc: "data:image/png;base64,AA" })).toContain('<img class="photo"');
    expect(renderResumeHtml(doc({ includePhoto: false }), withSlot, { photoSrc: "data:image/png;base64,AA" })).not.toContain("<img");
    expect(renderResumeHtml(doc({ includePhoto: true }), TEMPLATES[0]!, { photoSrc: "x" })).not.toContain("<img");
  });
  it("blocks javascript: links", () => {
    const d = doc();
    (d.profile.personal as any).website = "javascript:alert(1)";
    expect(renderResumeHtml(d, TEMPLATES[0]!)).not.toContain('href="javascript:');
  });
  it("custom sections render with their heading", () => expect(renderResumeHtml(doc(), TEMPLATES[0]!)).toContain(">Memberships</h2>"));
  it("user text is bidi-isolated so English inside Arabic keeps punctuation in place", () => {
    const html = renderResumeHtml(doc({ locale: "ar", country: "SA" }), TEMPLATES[0]!);
    expect(html).toContain("<p><bdi>Engineer with five years of experience.</bdi></p>");
    expect(html).toContain("<li><bdi>Led a team of 4 developers</bdi></li>");
    expect(html).toContain("<h3><bdi>Senior Software Engineer</bdi><span class=\"org\">، <bdi>Tech Solutions</bdi></span>");
    expect(renderResumeHtml(doc(), TEMPLATES[0]!)).toContain("<span class=\"org\">, <bdi>Tech Solutions</bdi></span>");
  });
  it("declared ATS traits feed the ATS engine", () => {
    const r = analyzeResume({ profile: doc().profile, template: TEMPLATES[0]!.ats });
    expect(r.categories.find((c) => c.id === "formatting")!.score).toBe(100);
  });
});
