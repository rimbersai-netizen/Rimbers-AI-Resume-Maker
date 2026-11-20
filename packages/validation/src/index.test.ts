import { describe, expect, it } from "vitest";
import { isPlausiblePhone, isSafeHttpUrl, sanitizeText, validateMasterProfile } from "./index";

describe("isPlausiblePhone", () => {
  it.each(["+966 50 123 4567", "(555) 123-4567", "+44 20 7946 0958"])("accepts %s", (p) =>
    expect(isPlausiblePhone(p)).toBe(true));
  it.each(["123", "call me", "+1 555 abc 1234", "1234567890123456"])("rejects %s", (p) =>
    expect(isPlausiblePhone(p)).toBe(false));
});

describe("isSafeHttpUrl", () => {
  it("allows https", () => expect(isSafeHttpUrl("https://linkedin.com/in/x")).toBe(true));
  it.each(["javascript:alert(1)", "data:text/html,x", "file:///etc/passwd", "not a url"])("blocks %s", (u) =>
    expect(isSafeHttpUrl(u)).toBe(false));
});

describe("sanitizeText", () => {
  it("removes control characters but keeps newlines", () =>
    expect(sanitizeText("a\u0000b\nc\u0007")).toBe("ab\nc"));
  it("NFC-normalizes", () => expect(sanitizeText("é")).toBe("é"));
  it("preserves Arabic text", () => expect(sanitizeText(" مهندس مدني ")).toBe("مهندس مدني"));
});

describe("validateMasterProfile", () => {
  const base = { schemaVersion: 1, personal: { fullName: "Lee Min" } };
  it("passes a clean profile", () => expect(validateMasterProfile(base).ok).toBe(true));
  it("flags bad phone", () => {
    const r = validateMasterProfile({ ...base, personal: { ...base.personal, phone: "abc" } });
    expect(!r.ok && r.error[0]?.path).toBe("personal.phone");
  });
  it("flags duplicate ids across sections", () => {
    const r = validateMasterProfile({
      ...base,
      skills: [{ id: "x", name: "SQL" }],
      languages: [{ id: "x", language: "Korean" }],
    });
    expect(r.ok).toBe(false);
  });
  it("returns schema issues with paths", () => {
    const r = validateMasterProfile({ schemaVersion: 1, personal: {} });
    expect(!r.ok && r.error.some((i) => i.path === "personal.fullName")).toBe(true);
  });
});
