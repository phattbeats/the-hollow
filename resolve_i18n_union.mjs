import { readFileSync, writeFileSync, existsSync } from 'node:fs';

// Generalized i18n conflict resolver for a stale content-pack merge.
//   node resolve_i18n_union.mjs <branchMarker>
// where <branchMarker> is e.g. "origin/pack/rare-elites".
// - i18n.en.ts: token-level union per array section (keep OURS structure +
//   append theirs-only quoted tokens) — handles the asymmetric mob lists.
// - i18n.locales/*.ts: pure disjoint flat-key union (strip the marker lines).
const BRANCH = process.argv[2];
if (!BRANCH) throw new Error('usage: resolve_i18n_union.mjs <branchMarker>');

const isStart = (l) => /^<<<<<<< (ours|HEAD)$/.test(l);
const isMid = (l) => l === '=======';
const isEnd = (l) => /^>>>>>>> /.test(l);
const anyMarker = (l) => isStart(l) || isMid(l) || isEnd(l);

const LOCALES = ['de_DE','en_CA','es','es_ES','fr_CA','fr_FR','it_IT','ja_JP','ko_KR','pt_BR','ru_RU','zh_CN','zh_TW'];
for (const loc of LOCALES) {
  const p = `src/ui/i18n.locales/${loc}.ts`;
  if (!existsSync(p)) continue;
  const txt = readFileSync(p, 'utf8');
  if (!/<<<<<<</.test(txt)) continue;
  const out = txt.split('\n').filter((l) => !anyMarker(l)).join('\n');
  if (/<<<<<<<|>>>>>>>/.test(out)) throw new Error(`markers remain in ${p}`);
  writeFileSync(p, out);
}

const EN = 'src/ui/i18n.en.ts';
const lines = readFileSync(EN, 'utf8').split('\n');
const toks = (arr) => arr.join('\n').match(/'[^']*'|"[^"]*"/g) || [];
const indentOf = (l) => (l.match(/^\s*/) || [''])[0];
function sections(side) {
  const itemEnd = side.findIndex((l) => /\],\s*'item'\)/.test(l));
  const mobEnd = side.findIndex((l) => /\],\s*'mob'\)/.test(l));
  if (itemEnd === -1 && mobEnd === -1) return { plain: side };
  const mobHdr = side.findIndex((l) => /mergeNameTranslations\(MERGE_MOB_IDS/.test(l));
  return { item: itemEnd === -1 ? [] : side.slice(0, itemEnd), mob: mobHdr === -1 ? [] : side.slice(mobHdr + 1, mobEnd) };
}

const out = [];
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (!isStart(l)) { out.push(l); continue; }
  const mid = lines.indexOf('=======', i);
  let end = i + 1; while (!isEnd(lines[end])) end++;
  const ours = lines.slice(i + 1, mid);
  const theirs = lines.slice(mid + 1, end);
  const os = sections(ours), ts = sections(theirs);
  if (os.plain) {
    const have = new Set(toks(ours));
    const extra = toks(theirs).filter((t) => !have.has(t));
    out.push(...ours);
    if (extra.length) out.push(indentOf(ours[ours.length - 1]) + extra.join(', ') + ',');
  } else {
    const haveItem = new Set(toks(os.item || [])), haveMob = new Set(toks(os.mob || []));
    const newItem = toks(ts.item || []).filter((t) => !haveItem.has(t));
    const newMob = toks(ts.mob || []).filter((t) => !haveMob.has(t));
    for (const ol of ours) {
      if (/\],\s*'item'\)/.test(ol) && newItem.length) out.push(indentOf((os.item && os.item[os.item.length - 1]) || ol) + newItem.join(', ') + ',');
      if (/\],\s*'mob'\)/.test(ol) && newMob.length) out.push(indentOf((os.mob && os.mob[os.mob.length - 1]) || ol) + newMob.join(', ') + ',');
      out.push(ol);
    }
  }
  i = end;
}
const result = out.join('\n');
if (/^<<<<<<<|^>>>>>>>|^=======$/m.test(result)) throw new Error('markers remain in i18n.en.ts');
writeFileSync(EN, result);
console.log('i18n union resolved for', BRANCH);
