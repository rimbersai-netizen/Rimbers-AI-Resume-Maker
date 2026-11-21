import { describe, expect, it } from "vitest";
import {
  chooseLocaleManually, coverage, isRtlLocale, matchSupported, mergeSavedLocales, resolveAppLocale, t, translate,
} from "./index";

describe("resolveAppLocale — required scenarios", () => {
  it("English device, first launch → en (device)", () =>
    expect(resolveAppLocale({ deviceLocales: ["en-US"] })).toEqual({ locale: "en", source: "device", changed: true }));
  it("Arabic device → ar", () => expect(resolveAppLocale({ deviceLocales: ["ar-SA"] }).locale).toBe("ar"));
  it("Urdu device → ur", () => expect(resolveAppLocale({ deviceLocales: ["ur-PK"] }).locale).toBe("ur"));
  it("German device → de", () => expect(resolveAppLocale({ deviceLocales: ["de-DE"] }).locale).toBe("de"));
  it("unsupported device language → English, not country language", () =>
    expect(resolveAppLocale({ deviceLocales: ["sw-KE"], countryCode: "SA" })).toMatchObject({ locale: "en", source: "default" }));
  it("uses the first SUPPORTED language in the device list", () =>
    expect(resolveAppLocale({ deviceLocales: ["sw", "fil", "fr-CA"] }).locale).toBe("fr"));
  it("Saudi Arabia does not force Arabic for an English device", () =>
    expect(resolveAppLocale({ deviceLocales: ["en-GB"], countryCode: "SA" }).locale).toBe("en"));
  it("Pakistan does not force Urdu for an English device", () =>
    expect(resolveAppLocale({ deviceLocales: ["en-PK"], countryCode: "PK" }).locale).toBe("en"));
  it("country suggestion only when the device reports no language", () =>
    expect(resolveAppLocale({ deviceLocales: [], countryCode: "DE" })).toMatchObject({ locale: "de", source: "country" }));
  it("multilingual country with no device language → English", () =>
    expect(resolveAppLocale({ deviceLocales: [], countryCode: "IN" }).locale).toBe("en"));
});

describe("persistence and manual choice", () => {
  it("manual choice persists across launches, even if device language differs", () => {
    const saved = chooseLocaleManually("ar");
    expect(resolveAppLocale({ saved, deviceLocales: ["de-DE"], countryCode: "US" })).toEqual({ locale: "ar", source: "manual", changed: false });
  });
  it("manual choice survives country change", () => {
    const saved = chooseLocaleManually("en");
    expect(resolveAppLocale({ saved, deviceLocales: [], countryCode: "SA" }).locale).toBe("en");
  });
  it("automatic choice follows a device language change", () =>
    expect(resolveAppLocale({ saved: { locale: "en", source: "device" }, deviceLocales: ["tr-TR"] })).toMatchObject({ locale: "tr", changed: true }));
  it("automatic choice kept when device switches to unsupported language", () =>
    expect(resolveAppLocale({ saved: { locale: "de", source: "device" }, deviceLocales: ["sw"] })).toEqual({ locale: "de", source: "device", changed: false }));
  it("rejects unsupported manual choice", () => expect(() => chooseLocaleManually("xx")).toThrow());
  it("guest→account merge: manual wins", () => {
    expect(mergeSavedLocales({ locale: "ar", source: "manual" }, { locale: "en", source: "device" })?.locale).toBe("ar");
    expect(mergeSavedLocales({ locale: "ar", source: "device" }, { locale: "de", source: "manual" })?.locale).toBe("de");
  });
});

describe("matching + direction", () => {
  it.each([["pt_BR", "pt"], ["zh-Hans-CN", "zh"], ["DE-at", "de"], ["en", "en"], ["xx-YY", undefined]])("%s → %s", (i, o) =>
    expect(matchSupported(i)).toBe(o));
  it("RTL detection", () => {
    expect(isRtlLocale("ar-SA")).toBe(true);
    expect(isRtlLocale("ur")).toBe(true);
    expect(isRtlLocale("en")).toBe(false);
  });
});

describe("catalogs", () => {
  it("translates and interpolates", () => expect(t("ar", "home.greeting", { name: "Ayesha" })).toBe("مرحبًا، Ayesha"));
  it("falls back per key to English, never blank", () => {
    expect(translate("ar", "common.loading")).toEqual({ text: "Loading…", from: "en" });
    expect(t("ja", "auth.signIn")).toBe("Sign in");
  });
  it("reports Arabic as partial machine translation, not fully supported", () => {
    const c = coverage("ar");
    expect(c.status).toBe("machine");
    expect(c.percent).toBeLessThan(100);
    expect(c.fullySupported).toBe(false);
    expect(c.placeholderMismatches).toEqual([]);
  });
  it("English is complete", () => expect(coverage("en").fullySupported).toBe(true));
});
