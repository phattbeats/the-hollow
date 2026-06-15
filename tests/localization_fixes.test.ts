import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { localizeServerText, DICT as serverDICT } from "../src/ui/server_i18n";
import { DICT as adminDICT } from "../src/admin/i18n";
import {
  setLanguage, supportedLanguages,
  en, es, es_ES, fr_FR, fr_CA, en_CA, it_IT, de_DE, zh_CN, zh_TW, ko_KR, ja_JP, pt_BR, ru_RU,
} from "../src/ui/i18n";
import { talentTranslationManifest, renderTalentManifestEntry, hasTalentTitleOverride } from "../src/ui/talent_i18n";
import { ABILITIES } from "../src/sim/data";

const locales: Record<string, any> = { en, es, es_ES, fr_FR, fr_CA, en_CA, it_IT, de_DE, zh_CN, zh_TW, ko_KR, ja_JP, pt_BR, ru_RU };
const ph = (s: string) => [...String(s).matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((m) => m[1]).sort().join(",");

// --- B1: the log-event path must localize server-sent friends/guild/who/world messages ---
describe("B1: server log-type messages localize through the log path", () => {
  it("localizeSystemText wires in localizeServerText (regression guard)", () => {
    const src = fs.readFileSync(path.resolve(process.cwd(), "src/ui/hud.ts"), "utf8");
    const start = src.indexOf("private localizeSystemText(");
    expect(start, "localizeSystemText not found").toBeGreaterThan(0);
    const body = src.slice(start, src.indexOf("\n  private ", start + 1));
    expect(body, "localizeSystemText must fall back to localizeServerText").toContain("localizeServerText");
  });

  it("recognizes and localizes the actual server log-type messages in every locale", () => {
    const logMessages = [
      "Mira added to friends.",
      "Mira removed from friends.",
      "Bob has joined the guild.",
      "Bob has left the guild.",
      "Aldric is now the Guild Master of <Knights>.",
      "Mira has been removed from the guild by Bob.",
      "Bob is now Officer.",
      "You found the guild <Knights>! You are its Guild Master.",
      "You have left <Knights>.",
      "Mira has entered World of Claudecraft.",
      "Bob has left the world. (disconnected)",
      "Who: 3 players online on Stormforge.",
      "Who: 1 player online on Stormforge.",
      "Carl - level 12 warrior - Eastbrook Vale",
    ];
    for (const lang of supportedLanguages) {
      setLanguage(lang);
      for (const m of logMessages) {
        const out = localizeServerText(m);
        expect(out, `${lang}: "${m}" should be recognized`).not.toBeNull();
        if (lang !== "en" && lang !== "en_CA") expect(out, `${lang}: "${m}" should not stay English`).not.toBe(m);
      }
    }
    setLanguage("en");
  });
});

// --- L3 / L4: extra server-message coverage ---
describe("L3/L4: additional server-message coverage", () => {
  it("localizes the ignore-list-loading error in every locale", () => {
    const msg = "Your ignore list is still loading. Try /who again in a moment.";
    for (const lang of supportedLanguages) {
      setLanguage(lang);
      const out = localizeServerText(msg);
      expect(out, `${lang}`).not.toBeNull();
      if (lang !== "en" && lang !== "en_CA") expect(out, `${lang}`).not.toBe(msg);
    }
    setLanguage("en");
  });

  it("localizes the (combat) /who status flag", () => {
    setLanguage("es");
    const out = localizeServerText("Carl - level 12 warrior - Eastbrook Vale (combat)")!;
    expect(out).toContain("Carl");
    expect(out.toLowerCase()).not.toContain("(combat)");
    setLanguage("en");
  });
});

// --- H1: talent names never fall to raw word-substitution ---
describe("H1: every talent name resolves via override or ability name", () => {
  const abilityNames = new Set(Object.values(ABILITIES).map((a) => a.name));
  const nameEntries = talentTranslationManifest().filter((e) => e.field === "name");

  it("each talent name has an explicit override or is an ability name in every translated locale", () => {
    for (const lang of supportedLanguages) {
      if (lang === "en" || lang === "en_CA") continue;
      for (const e of nameEntries) {
        const ok = hasTalentTitleOverride(lang, e.source) || abilityNames.has(e.source);
        expect(ok, `${lang}: talent name "${e.source}" falls through to broken word-substitution`).toBe(true);
      }
    }
  });

  it("CJK talent names contain no leftover Latin words", () => {
    for (const lang of ["zh_CN", "zh_TW", "ja_JP", "ko_KR"] as const) {
      setLanguage(lang);
      for (const e of nameEntries) {
        const rendered = renderTalentManifestEntry(e);
        expect(/[A-Za-z]{2,}/.test(rendered), `${lang}: "${e.source}" -> "${rendered}" has leftover English`).toBe(false);
      }
    }
    setLanguage("en");
  });
});

// --- H2: game.* keeps required diacritics ---
describe("H2: game.* values keep required diacritics", () => {
  const stripped: Record<string, RegExp> = {
    es: /\b(Clasificacion|posicion|Campeon|Mitico|Especializacion|Maestria|Configuracion|Dano|cosmetica|maximo|proximamente|actualizacion|arbol|arboles|Aun)\b/,
    es_ES: /\b(Clasificacion|posicion|Campeon|Mitico|Especializacion|Maestria|Configuracion|Dano|cosmetica|maximo|proximamente|actualizacion|arbol|arboles|Aun)\b/,
    fr_FR: /\b(debloque|Reessayez|Eternel|Specialisation|Depenses|sauvegardee)\b/,
    fr_CA: /\b(debloque|Reessayez|Eternel|Specialisation|Depenses|sauvegardee)\b/,
    pt_BR: /\b(Posicao|Classificacao|Especializacao|Nivel|Voce|Funcao|nao)\b/,
    de_DE: /(naechsten|erhoeht|zurueck|Ueberschuss|Verfuegbar)/,
  };
  it("no accent-stripped forms remain in the game.* subtree", () => {
    for (const [lang, re] of Object.entries(stripped)) {
      const flat = JSON.stringify(locales[lang].game);
      const m = flat.match(re);
      expect(m, `${lang}: stripped form "${m?.[0]}" still present`).toBeNull();
    }
  });
});

// --- M1: quest narratives preserve {playerName} ---
describe("M1: quest narratives preserve {playerName}", () => {
  it("every locale keeps {playerName} wherever English uses it", () => {
    const enQuests = en.entities.quests as Record<string, any>;
    for (const lang of supportedLanguages) {
      const locQuests = locales[lang].entities.quests as Record<string, any>;
      for (const qid of Object.keys(enQuests)) {
        for (const field of ["text", "completion"] as const) {
          const ev = enQuests[qid]?.[field];
          if (typeof ev === "string" && ev.includes("{playerName}")) {
            const lv = locQuests[qid]?.[field];
            expect(typeof lv === "string" && lv.includes("{playerName}"), `${lang}.${qid}.${field} dropped {playerName}`).toBe(true);
          }
        }
      }
    }
  });
});

// --- H3: server_i18n + admin DICT completeness (the Record<string,string> dicts lack : typeof en) ---
describe("H3: DICT key parity, non-empty values, placeholder integrity", () => {
  function checkDict(dict: Record<string, Record<string, string>>, label: string) {
    const enKeys = Object.keys(dict.en);
    for (const lang of Object.keys(dict)) {
      expect(Object.keys(dict[lang]).length, `${label} ${lang} key count`).toBe(enKeys.length);
      for (const k of enKeys) {
        const v = dict[lang][k];
        expect(typeof v === "string" && v.trim().length > 0, `${label} ${lang}.${k} empty/missing`).toBe(true);
        expect(ph(v), `${label} ${lang}.${k} placeholders`).toBe(ph(dict.en[k]));
      }
    }
  }
  it("server_i18n DICT is complete across all locales", () => checkDict(serverDICT as any, "server"));
  it("admin DICT is complete across all locales", () => checkDict(adminDICT as any, "admin"));

  it("L7: no admin DICT value contains raw HTML markup", () => {
    for (const lang of Object.keys(adminDICT)) {
      for (const [k, v] of Object.entries((adminDICT as any)[lang])) {
        expect(/[<>]/.test(v as string), `admin ${lang}.${k} contains < or >`).toBe(false);
      }
    }
  });
});
