import { describe, expect, it } from "vitest";
import { Email, Password, safeNext } from "./validation";

describe("safeNext (open-redirect protection)", () => {
  it.each(["/dashboard", "/account?x=1"])("allows %s", (p) => expect(safeNext(p)).toBe(p));
  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "", null, 42])("rejects %s", (p) => expect(safeNext(p)).toBe("/dashboard"));
});
describe("Password policy mirrors Supabase config", () => {
  it("accepts strong", () => expect(Password.safeParse("Abcdefgh12").success).toBe(true));
  it.each(["short1A", "alllowercase123", "ALLUPPERCASE123", "NoDigitsHereAtAll"])("rejects %s", (p) => expect(Password.safeParse(p).success).toBe(false));
});
describe("Email", () => {
  it("normalises case/whitespace", () => expect(Email.parse("  User@Example.COM ")).toBe("user@example.com"));
});
