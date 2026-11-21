import { describe, expect, it } from "vitest";
import { cleanEmpty, emptyDraft, mergeAcceptedBullets, toDraft, issuesForStep, move, normalizeIds, prepareForSave, recoveryDecision, stepComplete, type Draft } from "./profile-draft";

const valid = (): Draft => ({
  ...emptyDraft(),
  personal: { fullName: "Ayesha Khan", email: "ayesha@example.com", location: { city: "Riyadh" } },
  experience: [{ id: "legacy-1", employer: "Tech", title: "Engineer", dates: { start: "2021-01", current: true }, bullets: [{ id: "b1", text: "Led team", provenance: "user" }, { id: "b2", text: "  ", provenance: "user" }] }],
});

describe("cleanEmpty", () => {
  it("drops empty strings and trims", () =>
    expect(cleanEmpty({ a: "", b: "  x ", c: { d: "   " }, e: ["", "y"] })).toEqual({ b: "x", c: {}, e: ["", "y"] }));
});

describe("prepareForSave", () => {
  it("accepts a valid draft, assigns uuids to non-uuid ids, drops blank bullets", () => {
    const r = prepareForSave(valid());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.profile.experience[0]!.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(r.profile.experience[0]!.bullets.map((b) => b.text)).toEqual(["Led team"]);
  });
  it("empty optional link fields from the form do not fail validation", () => {
    const d = valid();
    d.personal.linkedin = "";
    d.personal.website = "   ";
    expect(prepareForSave(d).ok).toBe(true);
  });
  it("maps errors to field paths with friendly messages", () => {
    const d = valid();
    d.personal.fullName = "";
    d.personal.linkedin = "linkedin.com/in/x";
    d.experience[0]!.title = "";
    const r = prepareForSave(d);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.issues["personal.fullName"]).toBe("Required");
    expect(r.issues["personal.linkedin"]).toMatch(/https:\/\//);
    expect(r.issues["experience.0.title"]).toBe("Required");
    expect(issuesForStep(r.issues, "experience")).toEqual(["experience.0.title"]);
  });
  it("rejects end date before start", () => {
    const d = valid();
    d.experience[0]!.dates = { start: "2022-05", end: "2020-01", current: false };
    expect(prepareForSave(d).ok).toBe(false);
  });
  it("rejects javascript: links (schema url + safe-link check)", () => {
    const d = valid();
    d.personal.website = "javascript:alert(1)";
    expect(prepareForSave(d).ok).toBe(false);
  });
});

describe("recoveryDecision", () => {
  const server = { id: "p1", updatedAt: "2026-11-21T10:00:00Z", profile: valid() };
  it("none when nothing local or identical", () => {
    expect(recoveryDecision(null, server)).toBe("none");
    expect(recoveryDecision({ profileId: "p1", draft: valid(), baseUpdatedAt: server.updatedAt, savedAt: "x" }, server)).toBe("none");
  });
  it("restore when local edits sit on the current server version", () => {
    const d = valid(); d.summary = "New unsaved summary";
    expect(recoveryDecision({ profileId: "p1", draft: d, baseUpdatedAt: server.updatedAt, savedAt: "x" }, server)).toBe("restore");
  });
  it("restore_conflict when the server changed since", () => {
    const d = valid(); d.summary = "Edited offline";
    expect(recoveryDecision({ profileId: "p1", draft: d, baseUpdatedAt: "2026-11-20T00:00:00Z", savedAt: "x" }, server)).toBe("restore_conflict");
  });
  it("ignores drafts for a different profile", () => {
    const d = valid(); d.summary = "x";
    expect(recoveryDecision({ profileId: "other", draft: d, baseUpdatedAt: server.updatedAt, savedAt: "x" }, server)).toBe("none");
  });
});

describe("stepper + helpers", () => {
  it("step completion", () => {
    const d = valid();
    expect(stepComplete(d, "personal")).toBe(true);
    expect(stepComplete(d, "experience")).toBe(true);
    expect(stepComplete(d, "education")).toBe(false);
    expect(stepComplete(emptyDraft(), "personal")).toBe(false);
  });
  it("move reorders and ignores out-of-range", () => {
    expect(move([1, 2, 3], 0, 2)).toEqual([2, 3, 1]);
    expect(move([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
  });
  it("normalizeIds keeps valid uuids stable", () => {
    const id = "e0000000-0000-4000-8000-000000000001";
    const d = valid(); d.experience[0]!.id = id;
    expect(normalizeIds(d).experience[0]!.id).toBe(id);
  });
});

describe("toDraft", () => {
  it("fills a complete shape for a brand-new (invalid) profile from the DB", () => {
    const d = toDraft({ schemaVersion: 1, personal: { fullName: "" }, experience: [] });
    expect(d.personal.location).toEqual({});
    expect(d.skills).toEqual([]);
    expect(d.customSections).toEqual([]);
  });
  it("repairs partial items (missing dates/bullets) and garbage input", () => {
    const d = toDraft({ personal: {}, experience: [{ id: "x", employer: "", title: "" }] } as never);
    expect(d.experience[0]!.dates.current).toBe(false);
    expect(d.experience[0]!.bullets).toEqual([]);
    expect(toDraft(null).personal.fullName).toBe("");
  });
  it("returns valid profiles unchanged", () => {
    const v = valid();
    expect(toDraft(v).personal.fullName).toBe("Ayesha Khan");
  });
});

describe("mergeAcceptedBullets", () => {
  const existing = [{ id: "b1", text: "Led a team of 4", provenance: "user" as const }, { id: "b2", text: "Built APIs", provenance: "import" as const }];
  it("unchanged text keeps id + original provenance; new/changed text is ai_accepted", () => {
    const r = mergeAcceptedBullets(existing, ["Led a team of 4", "Designed and built REST APIs", "  "]);
    expect(r[0]).toEqual({ id: "b1", text: "Led a team of 4", provenance: "user" });
    expect(r[1]).toMatchObject({ text: "Designed and built REST APIs", provenance: "ai_accepted" });
    expect(r).toHaveLength(2);
  });
});
