import { describe, expect, it } from "vitest";
import { DateRange, parseMasterProfile, parseResumeDocument, PartialDate } from "./index";

const minimalProfile = {
  schemaVersion: 1,
  personal: { fullName: "Amina Rahman", email: "amina@example.com" },
};

describe("PartialDate", () => {
  it.each(["2024", "2024-03", "2024-03-15"])("accepts %s", (d) => {
    expect(PartialDate.safeParse(d).success).toBe(true);
  });
  it.each(["24", "2024-13", "2024-3", "March 2024", "2024-02-40"])("rejects %s", (d) => {
    expect(PartialDate.safeParse(d).success).toBe(false);
  });
});

describe("DateRange", () => {
  it("rejects end before start", () => {
    expect(DateRange.safeParse({ start: "2024-05", end: "2023-01" }).success).toBe(false);
  });
  it("accepts mixed precision where end year equals start year", () => {
    expect(DateRange.safeParse({ start: "2024-05", end: "2024" }).success).toBe(true);
  });
  it("rejects current role with end date", () => {
    expect(DateRange.safeParse({ start: "2020", end: "2022", current: true }).success).toBe(false);
  });
});

describe("MasterProfile", () => {
  it("accepts a minimal profile and fills defaults", () => {
    const r = parseMasterProfile(minimalProfile);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.experience).toEqual([]);
      expect(r.data.personal.location).toEqual({});
    }
  });
  it("does not require sensitive fields (photo, work authorization)", () => {
    const r = parseMasterProfile(minimalProfile);
    expect(r.success && r.data.personal.photoPath).toBeFalsy();
  });
  it("rejects missing full name", () => {
    expect(parseMasterProfile({ schemaVersion: 1, personal: { fullName: "" } }).success).toBe(false);
  });
  it("defaults bullet provenance to user", () => {
    const r = parseMasterProfile({
      ...minimalProfile,
      experience: [{ id: "w1", employer: "Acme", title: "Engineer", dates: { start: "2020" }, bullets: [{ id: "b1", text: "Built X" }] }],
    });
    expect(r.success && r.data.experience[0]?.bullets[0]?.provenance).toBe("user");
  });
});

describe("ResumeDocument", () => {
  it("accepts a valid document", () => {
    const r = parseResumeDocument({
      schemaVersion: 1, id: "r1", title: "SA Engineer", country: "SA", locale: "ar",
      templateId: "ats-minimal-01", pageSize: "A4", sectionOrder: ["summary", "experience"],
      profile: minimalProfile,
    });
    expect(r.success).toBe(true);
  });
  it("rejects unsupported locale and empty section order", () => {
    const r = parseResumeDocument({
      schemaVersion: 1, id: "r1", title: "x", country: "US", locale: "xx",
      templateId: "t", pageSize: "Letter", sectionOrder: [], profile: minimalProfile,
    });
    expect(r.success).toBe(false);
  });
});
