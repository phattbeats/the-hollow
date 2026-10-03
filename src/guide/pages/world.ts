// World / zones: a schematic south-to-north map plus a card per zone, fed from sim zone
// data (name, level band, hub town, point-of-interest labels) with curated, spoiler-safe
// blurbs. Resident creature families are derived from the bestiary level bands and link
// into it. Place and hub names are the English sim source (proper nouns), like creature
// and class names elsewhere in the guide.

import { esc } from '../../ui/esc';
import { formatNumber, type TranslationKey, t } from '../../ui/i18n';
import { GUIDE_FAMILIES, GUIDE_ZONES, type GuideZoneInfo } from '../content.generated';
import { hrefFor } from '../routes';
import type { GuidePage } from './types';
import { loreFigure, loreQuote, pageHeader, related } from './ui';

// Keyed by zone id, not biome: the Hollow Reaches shares the 'vale' render biome with
// Eastbrook Vale (see hollow_zone.ts), so biome alone can no longer tell zones apart
// for copy or for the anchor id below. Explicit rather than derived from the id so the
// existing vale/marsh/peaks catalog keys (and their locale overlays) don't need renaming.
const ZONE_KEY_PREFIX: Record<string, string> = {
  the_hollow_reaches: 'hollowReaches',
  eastbrook_vale: 'vale',
  mirefen_marsh: 'marsh',
  thornpeak_heights: 'peaks',
};
const zoneKeyPrefix = (z: GuideZoneInfo): string => ZONE_KEY_PREFIX[z.id] ?? z.biome;
const blurbKey = (z: GuideZoneInfo): TranslationKey =>
  `guide.worldPage.${zoneKeyPrefix(z)}Blurb` as TranslationKey;
// Per-zone hub greeting (the spoken line + its speaker proper noun) and place notes.
const greetingKey = (z: GuideZoneInfo): TranslationKey =>
  `guide.worldPage.${zoneKeyPrefix(z)}Greeting` as TranslationKey;
const greeterText = (z: GuideZoneInfo): string =>
  t(`guide.worldPage.${zoneKeyPrefix(z)}Greeter` as TranslationKey);
const placeNotesKey = (z: GuideZoneInfo): TranslationKey =>
  `guide.worldPage.${zoneKeyPrefix(z)}PlaceNotes` as TranslationKey;
const familyName = (family: string): string => t(`guide.family.${family}.name` as TranslationKey);
const bandLabel = (z: GuideZoneInfo): string =>
  t('guide.home.world.levels', { min: formatNumber(z.min), max: formatNumber(z.max) });

// Which creature families live in a zone: any family with a creature whose level band
// overlaps the zone's. Drives the spoiler-safe "who you will meet" cross-links.
function residentFamilies(z: GuideZoneInfo): string[] {
  return GUIDE_FAMILIES.filter((fam) =>
    fam.creatures.some((c) => c.min <= z.max && c.max >= z.min),
  ).map((fam) => fam.family);
}

function mapHtml(): string {
  const bands = GUIDE_ZONES.map(
    (z) => `
      <a class="guide-worldmap-zone guide-zone-${esc(z.biome)}" href="#zone-${esc(z.id)}">
        <span class="guide-worldmap-band">${esc(bandLabel(z))}</span>
        <span class="guide-worldmap-name">${esc(z.name)}</span>
        ${z.hub ? `<span class="guide-worldmap-hub">${esc(z.hub)}</span>` : ''}
      </a>`,
  ).join('');
  return `
    <section class="guide-worldmap-wrap" aria-labelledby="guide-worldmap-h">
      <h2 class="guide-worldmap-h" id="guide-worldmap-h">${esc(t('guide.worldPage.mapHeading'))}</h2>
      <p class="guide-worldmap-sub">${esc(t('guide.worldPage.mapSub'))}</p>
      <div class="guide-worldmap">${bands}</div>
    </section>`;
}

function poisHtml(z: GuideZoneInfo): string {
  if (!z.pois.length) return '';
  const items = z.pois.map((label) => `<li class="guide-poi">${esc(label)}</li>`).join('');
  return `
    <div class="guide-zone-detail">
      <h3 class="guide-zone-subh">${esc(t('guide.worldPage.places'))}</h3>
      <ul class="guide-poi-list">${items}</ul>
      <p class="guide-zone-places-note">${esc(t(placeNotesKey(z)))}</p>
    </div>`;
}

function residentsHtml(z: GuideZoneInfo): string {
  const families = residentFamilies(z);
  if (!families.length) return '';
  const links = families
    .map(
      (fam) =>
        `<a class="guide-poi" href="${esc(hrefFor('bestiary'))}#fam-${esc(fam)}">${esc(familyName(fam))}</a>`,
    )
    .join('');
  return `
    <div class="guide-zone-detail">
      <h3 class="guide-zone-subh">${esc(t('guide.worldPage.residents'))}</h3>
      <div class="guide-poi-list">${links}</div>
    </div>`;
}

function zoneCard(z: GuideZoneInfo): string {
  return `
    <section class="guide-zone-card guide-zone-${esc(z.biome)}" id="zone-${esc(z.id)}">
      <div class="guide-zone-body">
        <span class="guide-zone-band">${esc(bandLabel(z))}</span>
        <h2 class="guide-zone-name">${esc(z.name)}</h2>
        <p class="guide-zone-blurb">${esc(t(blurbKey(z)))}</p>
        ${z.hub ? `<p class="guide-zone-hub"><span>${esc(t('guide.worldPage.hub'))}:</span> ${esc(z.hub)}</p>` : ''}
        ${loreQuote(greetingKey(z), greeterText(z))}
        ${poisHtml(z)}
        ${residentsHtml(z)}
      </div>
    </section>`;
}

export const world: GuidePage = {
  titleKey: 'guide.nav.world',
  render() {
    return `
      <article class="guide-article guide-world">
        ${pageHeader('guide.worldPage.heading', 'guide.worldPage.intro')}
        ${mapHtml()}
        <div class="guide-zone-grid guide-zone-grid-detail">${GUIDE_ZONES.map(zoneCard).join('')}</div>

        <section class="guide-block">
          <h2>${esc(t('guide.lore.figuresTitle'))}</h2>
          <p>${esc(t('guide.lore.figuresBody'))}</p>
          <div class="guide-figures">
            ${loreFigure('Verger Zebediah', 'guide.lore.zebediahRole', 'guide.lore.zebediahBody')}
            ${loreFigure('Sexton Faddick', 'guide.lore.faddickRole', 'guide.lore.faddickBody')}
          </div>
        </section>

        <section class="guide-block">
          <h2>${esc(t('guide.worldPage.gladeTitle'))}</h2>
          <p>${esc(t('guide.worldPage.gladeBody'))}</p>
        </section>

        ${related([
          { href: hrefFor('hollow'), key: 'guide.nav.hollow' },
          { href: hrefFor('bestiary'), key: 'guide.nav.bestiary' },
          { href: hrefFor('quests'), key: 'guide.nav.quests' },
          { href: hrefFor('dungeons'), key: 'guide.nav.dungeons' },
          { href: hrefFor('delves'), key: 'guide.nav.delves' },
        ])}
      </article>`;
  },
};
