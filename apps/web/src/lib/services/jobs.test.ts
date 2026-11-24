import { vi } from "vitest";
vi.mock("server-only", () => ({}));
import { describe, expect, it } from "vitest";
import { htmlToText, parseSalaryMin, passesPrefs, type Job, PrefsSchema } from "./jobs";
import { containsContact } from "./community";

const job = (o: Partial<Job> = {}): Job => ({ key: "remotive:1", source: "remotive", externalId: "1", title: "Senior Software Engineer", company: "Acme", location: "Worldwide",
  workMode: "remote", postedAt: new Date().toISOString(), url: "https://x.test/1", tags: ["react"], description: "Build things.", ...o });
const prefs = (o: object = {}) => PrefsSchema.parse(o);

describe("feed text cleaning", () => {
  it("turns HTML into readable text and drops scripts", () => {
    expect(htmlToText("<p>Hello&nbsp;<b>world</b></p><ul><li>One</li><li>Two &amp; three</li></ul><script>alert(1)</script>")).toBe("Hello world\n• One\n• Two & three");
  });
  it("parses salary floors", () => {
    expect(parseSalaryMin("$100k - $120k")).toBe(100000);
    expect(parseSalaryMin("USD 85,000 - 95,000")).toBe(85000);
    expect(parseSalaryMin("competitive")).toBeUndefined();
  });
});

describe("preference filtering", () => {
  it("matches role families by title", () => {
    expect(passesPrefs(job(), prefs({ roles: ["engineer"] }))).toBe(true);
    expect(passesPrefs(job(), prefs({ roles: ["designer"] }))).toBe(false);
  });
  it("keeps jobs with unknown salary but drops ones below the floor", () => {
    expect(passesPrefs(job(), prefs({ minSalary: 100000 }))).toBe(true);
    expect(passesPrefs(job({ salaryMin: 60000 }), prefs({ minSalary: 100000 }))).toBe(false);
  });
  it("filters by freshness and work mode", () => {
    const old = job({ postedAt: new Date(Date.now() - 5 * 86400000).toISOString() });
    expect(passesPrefs(old, prefs({ postedWithinDays: 1 }))).toBe(false);
    expect(passesPrefs(old, prefs({ postedWithinDays: 7 }))).toBe(true);
    expect(passesPrefs(job({ workMode: "onsite" }), prefs({ workModes: ["remote"] }))).toBe(false);
  });
  it("rejects invalid preferences", () => {
    expect(PrefsSchema.safeParse({ roles: ["astronaut"] }).success).toBe(false);
    expect(PrefsSchema.safeParse({ postedWithinDays: 2 }).success).toBe(false);
  });
});

describe("community content guard", () => {
  it("blocks links, emails and phone numbers", () => {
    for (const s of ["see https://evil.test", "mail me a@b.co", "call +966 55 123 4567", "www.spam.com"]) expect(containsContact(s), s).toBe(true);
    expect(containsContact("Signed with Linear after 6 weeks and 41 swipes")).toBe(false);
  });
});
