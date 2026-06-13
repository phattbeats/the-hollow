import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { pool, getAccountsCount } from "../server/db";
import { t, setLanguage, getLanguage } from "../src/ui/i18n";

describe("i18n Translation Foundation", () => {
  beforeEach(() => {
    // Reset to base language
    setLanguage("en");
  });

  it("retrieves English translations by default", () => {
    expect(getLanguage()).toBe("en");
    expect(t("nav.home")).toBe("Home");
    expect(t("stats.playersOnline")).toBe("Players Online");
    expect(t("footer.copyright")).toBe("2026 World of Claudecraft");
    expect(t("footer.githubLabel")).toBe("Open Source Project");
  });

  it("updates language and retrieves Spanish translations", () => {
    setLanguage("es");
    expect(getLanguage()).toBe("es");
    expect(t("nav.home")).toBe("Inicio");
    expect(t("stats.playersOnline")).toBe("Jugadores en Línea");
    expect(t("footer.copyright")).toBe("2026 World of Claudecraft");
    expect(t("footer.githubLabel")).toBe("Proyecto de Código Abierto");
  });

  it("persists language selection in localStorage when available", () => {
    const mockStorage: Record<string, string> = {};
    const originalLocalStorage = global.localStorage;

    // Mock localStorage
    Object.defineProperty(global, "localStorage", {
      value: {
        getItem: (key: string) => mockStorage[key] || null,
        setItem: (key: string, value: string) => {
          mockStorage[key] = value;
        },
      },
      writable: true,
      configurable: true,
    });

    setLanguage("es");
    expect(global.localStorage.getItem("locale")).toBe("es");

    // Restore original localStorage
    if (originalLocalStorage) {
      Object.defineProperty(global, "localStorage", {
        value: originalLocalStorage,
        writable: true,
        configurable: true,
      });
    } else {
      // @ts-ignore
      delete global.localStorage;
    }
  });
});

describe("Database helper getAccountsCount", () => {
  let querySpy: any;

  beforeEach(() => {
    querySpy = vi.spyOn(pool, "query");
  });

  afterEach(() => {
    querySpy.mockRestore();
  });

  it("queries database and returns the integer count", async () => {
    querySpy.mockResolvedValueOnce({
      rows: [{ count: 42 }],
    });

    const count = await getAccountsCount();
    expect(count).toBe(42);
    expect(querySpy).toHaveBeenCalledTimes(1);
    expect(querySpy).toHaveBeenCalledWith("SELECT COUNT(*)::int AS count FROM accounts");
  });

  it("returns 0 when database response is empty", async () => {
    querySpy.mockResolvedValueOnce({
      rows: [],
    });

    const count = await getAccountsCount();
    expect(count).toBe(0);
  });
});
