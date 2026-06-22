// Classes: the index (a grid of all nine, with crests and role badges) and the per-class
// page (/guide/classes/<id>). Class data is generated from the sim (content.generated.ts);
// crests and ability icons are procedural (no image files). No numbers or formulas, in
// keeping with the high-level, spoiler-safe content philosophy.

import { t, type TranslationKey } from '../../ui/i18n';
import { esc } from '../../ui/esc';
import { iconDataUrl } from '../../ui/icons';
import { hrefFor } from '../routes';
import { GUIDE_CLASSES, type GuideRole } from '../content.generated';
import { lead } from './ui';
import type { GuidePage, PageContext } from './types';

function roleKey(role: GuideRole): TranslationKey {
  if (role === 'tank') return 'guide.role.tank';
  if (role === 'healer') return 'guide.role.healer';
  return 'guide.role.damage';
}
const className = (id: string): string => t(`classes.${id}` as TranslationKey);
const hook = (id: string): string => t(`guide.classHook.${id}` as TranslationKey);
const crest = (id: string): string => iconDataUrl('crest', `class_${id}`, 128);

function roleBadges(roles: GuideRole[]): string {
  return roles.map((r) => `<span class="guide-badge guide-role-${r}">${esc(t(roleKey(r)))}</span>`).join('');
}

function indexHtml(): string {
  const cards = GUIDE_CLASSES
    .map((c) => `
      <a class="guide-class-card" href="${esc(hrefFor(`classes/${c.id}`))}" style="--class-color:${esc(c.color)}">
        <img class="guide-class-crest" src="${esc(crest(c.id))}" alt="" width="64" height="64" loading="lazy" decoding="async" />
        <span class="guide-class-card-name">${esc(className(c.id))}</span>
        <span class="guide-badges">${roleBadges(c.roles)}</span>
        <span class="guide-class-card-hook">${esc(hook(c.id))}</span>
      </a>`)
    .join('');
  return `
    <div class="guide-article guide-classes-index">
      <h1>${esc(t('guide.classList.heading'))}</h1>
      ${lead('guide.classList.sub')}
      <div class="guide-class-cards">${cards}</div>
    </div>`;
}

function notFoundInline(): string {
  return `<article class="guide-article guide-notfound">
    <h1>${esc(t('guide.notFound.title'))}</h1>
    <p class="guide-lead">${esc(t('guide.notFound.body'))}</p>
    <p><a class="guide-cta" href="${esc(hrefFor('classes'))}">${esc(t('guide.classPage.back'))}</a></p>
  </article>`;
}

function detailHtml(id: string): string {
  const c = GUIDE_CLASSES.find((x) => x.id === id);
  if (!c) return notFoundInline();

  const specs = c.specs
    .map((s) => `<li class="guide-spec"><span class="guide-spec-name">${esc(s.name)}</span><span class="guide-badge guide-role-${s.role}">${esc(t(roleKey(s.role)))}</span></li>`)
    .join('');

  const abilities = c.signatureAbilities
    .map((a) => `
      <li class="guide-ability">
        <img class="guide-ability-icon" src="${esc(iconDataUrl('ability', a.id, 56))}" alt="" width="48" height="48" loading="lazy" decoding="async" />
        <span class="guide-ability-name">${esc(a.name)}</span>
      </li>`)
    .join('');

  return `
    <article class="guide-article guide-class-page" style="--class-color:${esc(c.color)}">
      <p class="guide-section-more"><a href="${esc(hrefFor('classes'))}">${esc(t('guide.classPage.back'))}</a></p>
      <header class="guide-class-hero">
        <img class="guide-class-hero-crest" src="${esc(crest(c.id))}" alt="" width="96" height="96" />
        <div>
          <h1 class="guide-class-hero-name">${esc(className(c.id))}</h1>
          <div class="guide-badges">
            ${roleBadges(c.roles)}
            <span class="guide-badge guide-badge-resource">${esc(t(`guide.resourceName.${c.resource}` as TranslationKey))}</span>
          </div>
        </div>
      </header>
      <p class="guide-lead">${esc(hook(c.id))}</p>

      <section class="guide-block">
        <h2>${esc(t('guide.classPage.specsHeading'))}</h2>
        <ul class="guide-spec-list">${specs}</ul>
      </section>

      <section class="guide-block">
        <h2>${esc(t('guide.classPage.abilitiesHeading'))}</h2>
        <p>${esc(t('guide.classPage.abilitiesNote'))}</p>
        <ul class="guide-ability-strip">${abilities}</ul>
      </section>
    </article>`;
}

export const classes: GuidePage = {
  titleKey: 'guide.nav.classes',
  titleFor(ctx: PageContext) {
    const id = ctx.params[0];
    return id && GUIDE_CLASSES.some((c) => c.id === id) ? className(id) : t('guide.classList.heading');
  },
  render(ctx: PageContext) {
    const id = ctx.params[0];
    return id ? detailHtml(id) : indexHtml();
  },
};
