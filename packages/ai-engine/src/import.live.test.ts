/** Real Gemini extraction of a synthetic CV through runAiJob. GEMINI_LIVE=1 + GEMINI_API_KEY. */
import { describe, expect, it } from "vitest";
import { MasterProfile } from "@gars/resume-schema";
import { GeminiProvider, OllamaProvider, runAiJob, type RouteConfig } from "./index";

const live = process.env.GEMINI_LIVE === "1" && Boolean(process.env.GEMINI_API_KEY);
const CV = `MARIA GONZALEZ
Marketing Manager
maria.gonzalez@example.com  +34 600 123 456  Madrid, Spain
www.linkedin.com/in/maria-gonzalez-example

PROFILE
Marketing manager with 9 years of experience in B2B growth.

WORK EXPERIENCE
Marketing Manager - Solaris Energy, Madrid (Jan 2020 - Present)
• Grew qualified leads by 45% in two years
• Managed a budget of 300,000 EUR
Digital Marketing Specialist - Nuvola Retail, Barcelona (Sept 2015 - Dec 2019)
• Launched the email program for 120,000 subscribers

EDUCATION
MBA, IE Business School, 2013 - 2015
BA Business Administration, Universidad de Valencia, 2008 - 2012

SKILLS
SEO, Google Analytics, HubSpot, Content strategy, Team leadership

LANGUAGES
Spanish - Native, English - C1, French - B1

CERTIFICATIONS
Google Analytics Certified (Google, 2021)`;

describe.skipIf(!live)("import_extract live", () => {
  it("extracts a real CV with Gemini and keeps only grounded values", async () => {
    const route: RouteConfig = { localModels: ["qwen3:4b"], maxAttempts: 2, backoffMs: 1500,
      cloud: { provider: new GeminiProvider({ apiKey: process.env.GEMINI_API_KEY!, fallbackModels: ["gemini-3.1-flash-lite", "gemini-3.7-flash"] }), model: "gemini-3.5-flash-lite", enabled: true, first: true, assumeConsent: true } };
    const r = await runAiJob({ kind: "import_extract", locale: "en", text: CV }, null, new OllamaProvider({ baseUrl: "http://127.0.0.1:1" }), route, { cloudConsent: true });
    if (r.output.kind !== "imported_profile") throw new Error("wrong kind");
    const p = r.output.profile as Record<string, any>;
    console.log(JSON.stringify({ model: r.model, counts: r.output.counts, dropped: r.output.dropped, name: p.personal.fullName, exp: p.experience.map((w: any) => `${w.title} @ ${w.employer} ${w.dates.start}..${w.dates.end ?? (w.dates.current ? "now" : "")}`), skills: p.skills.map((s: any) => s.name), langs: p.languages }, null, 1));
    expect(p.personal.fullName).toBe("Maria Gonzalez");
    expect(r.output.counts.experience).toBe(2);
    expect(r.output.counts.education).toBe(2);
    expect(r.output.counts.skills).toBeGreaterThanOrEqual(4);
    expect(MasterProfile.safeParse(p).success).toBe(true);
  }, 120_000);
});
