// Phase 2 of the i18n Lazy Locales feature: the async loader seam.
//
// ensureLocaleLoaded is the ONLY async surface in src/ui/i18n.ts; t() and setLanguage
// stay SYNCHRONOUS forever (locked decision 1). This proves the await is a NO-OP this
// phase: a non-en current language renders its translated string synchronously BOTH
// before AND after an awaited ensureLocaleLoaded. Everything is still static-imported
// through the barrel, so the dense table resolves without the load (the resident table
// is the seam Phase 3's real lazy flip switches onto).

import { afterEach, describe, expect, it } from "vitest";
import { t, setLanguage, ensureLocaleLoaded, isLocaleResident, en, de_DE, fr_FR } from "../src/ui/i18n";

describe("lazy-locale loader: t() stays synchronous around ensureLocaleLoaded", () => {
  afterEach(() => setLanguage("en"));

  it("renders a non-en locale synchronously BEFORE and AFTER the await", async () => {
    // Non-vacuous floor: the locale genuinely differs from English, so a regression that
    // fell back to en would be caught (not a trivially-passing equality).
    expect(de_DE.nav.play).not.toBe(en.nav.play);

    setLanguage("de_DE");

    // Pre-await: synchronous and correct, resolved via the still-static table backstop
    // (de_DE is not yet resident - only en + the boot language are pre-seeded).
    const before = t("nav.play");
    expect(typeof before).toBe("string");
    expect(before).toBe(de_DE.nav.play);

    await ensureLocaleLoaded("de_DE");
    expect(isLocaleResident("de_DE")).toBe(true);

    // Post-await: still synchronous, still correct, now resolved via the resident table.
    const after = t("nav.play");
    expect(typeof after).toBe("string");
    expect(after).toBe(de_DE.nav.play);
  });

  it("treats English as always resident and instant", async () => {
    expect(isLocaleResident("en")).toBe(true);
    await expect(ensureLocaleLoaded("en")).resolves.toBeUndefined();
  });

  it("coalesces concurrent loads of the same locale without crashing", async () => {
    await Promise.all([ensureLocaleLoaded("fr_FR"), ensureLocaleLoaded("fr_FR")]);
    expect(isLocaleResident("fr_FR")).toBe(true);

    // Once resident, t() renders that locale synchronously.
    setLanguage("fr_FR");
    expect(t("nav.play")).toBe(fr_FR.nav.play);
  });

  it("renders the 3 new language-load status keys via t() (en)", () => {
    setLanguage("en");
    expect(t("settings.languageLoading")).toBe(en.settings.languageLoading);
    expect(t("settings.languageLoadFailed")).toBe(en.settings.languageLoadFailed);
    expect(t("settings.languageLoadUnavailable")).toBe(en.settings.languageLoadUnavailable);
  });
});
