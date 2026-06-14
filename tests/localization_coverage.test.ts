import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  en,
  es,
  es_ES,
  fr_FR,
  fr_CA,
  en_CA,
  it_IT,
  de_DE,
  zh_CN,
  zh_TW,
  ko_KR,
  ja_JP,
  pt_BR,
  ru_RU,
  formatDateTime,
  formatNumber,
  isSupportedLanguage,
  languageTag,
  setLanguage,
  supportedLanguages,
  t,
  type TranslationKey,
} from "../src/ui/i18n";

const locales: Record<string, typeof en> = {
  es,
  es_ES,
  fr_FR,
  fr_CA,
  en_CA,
  it_IT,
  de_DE,
  zh_CN,
  zh_TW,
  ko_KR,
  ja_JP,
  pt_BR,
  ru_RU,
};

describe("i18n Localization Key Coverage", () => {
  const placeholderPattern = /\b(TODO|TBD|FIXME|PLACEHOLDER|TRANSLATE|LOREM)\b/i;
  const phaseOneShellKeys: TranslationKey[] = [
    "seo.title",
    "seo.description",
    "a11y.goHome",
    "loading.worldProgress",
    "errors.characterNameInvalid",
    "realm.onlineNow",
    "character.levelClass",
    "deleteCharacter.body",
    "classDetails.sections.startingStats",
    "mobilePreflight.title",
    "serverUnavailable.heading",
  ];

  function verifyKeys(base: Record<string, unknown>, target: Record<string, unknown>, path = "") {
    for (const key in base) {
      const currentPath = path ? `${path}.${key}` : key;
      expect(target).toHaveProperty(key);
      const baseValue = base[key];
      const targetValue = target[key];
      if (typeof baseValue === "object" && baseValue !== null) {
        expect(typeof target[key]).toBe("object");
        verifyKeys(baseValue as Record<string, unknown>, targetValue as Record<string, unknown>, currentPath);
      } else {
        expect(typeof targetValue).toBe("string");
        const text = targetValue as string;
        expect(text.trim().length, `${currentPath} should not be empty`).toBeGreaterThan(0);
        expect(text, `${currentPath} should not contain placeholder markers`).not.toMatch(placeholderPattern);
      }
    }
  }

  for (const [code, locale] of Object.entries(locales)) {
    it(`should have 100% key match and non-empty translations for locale: ${code}`, () => {
      verifyKeys(en, locale);
    });
  }

  it("should resolve nested keys accurately using t() helper", () => {
    setLanguage("en");
    expect(t("nav.home")).toBe("Home");
    expect(t("auth.usernamePlaceholder")).toBe("Enter username");
    expect(t("loading.worldProgress", { done: 3, total: 9 })).toBe("Loading world... 3/9");

    setLanguage("es");
    expect(t("nav.home")).toBe("Inicio");
    expect(t("auth.usernamePlaceholder")).toBe("Introduce tu usuario");
    expect(t("character.levelClass", { level: 7, className: "Maga" })).toBe("Nivel 7 Maga");

    setLanguage("en");
  });

  it("should expose typed locale utilities for shell metadata and formatting", () => {
    expect(supportedLanguages).toEqual([
      "en",
      "es",
      "es_ES",
      "fr_FR",
      "fr_CA",
      "en_CA",
      "it_IT",
      "de_DE",
      "zh_CN",
      "zh_TW",
      "ko_KR",
      "ja_JP",
      "pt_BR",
      "ru_RU",
    ]);
    expect(isSupportedLanguage("de_DE")).toBe(true);
    expect(isSupportedLanguage("de-DE")).toBe(false);
    expect(languageTag("fr_CA")).toBe("fr-CA");
    expect(formatNumber(1234.5, { maximumFractionDigits: 1 }, "de_DE")).toBe("1.234,5");
    expect(formatDateTime(new Date(Date.UTC(2026, 5, 14, 12)), { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "UTC" }, "en")).toBe("06/14/2026");
  });

  it("should keep technical transport errors out of localized user-facing dictionaries", () => {
    for (const locale of [en, ...Object.values(locales)]) {
      expect(locale.errors.api).not.toHaveProperty("requestFailed");
    }
  });

  it("should include current phase public shell keys in every locale", () => {
    for (const key of phaseOneShellKeys) {
      for (const lang of supportedLanguages) {
        setLanguage(lang);
        expect(t(key), `${lang}.${key}`).not.toBe(key);
        expect(t(key).trim().length, `${lang}.${key}`).toBeGreaterThan(0);
      }
    }
    setLanguage("en");
  });

  it("should expose all supported hreflang alternates in index.html", () => {
    const html = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf8");
    const expectedHreflang = [
      "en",
      "es",
      "es-ES",
      "fr-FR",
      "fr-CA",
      "en-CA",
      "it-IT",
      "de-DE",
      "zh-CN",
      "zh-TW",
      "ko-KR",
      "ja-JP",
      "pt-BR",
      "ru-RU",
      "x-default",
    ];
    for (const hreflang of expectedHreflang) {
      expect(html, `missing hreflang ${hreflang}`).toContain(`hreflang="${hreflang}"`);
    }
    expect(html).toContain('data-i18n-content="seo.description"');
    expect(html).toContain('id="structured-data"');
  });
});
