// Boarball (PHAA-572): data-as-code for the unranked 2v2 sport minigame, ADAPTED
// from upstream's Vale Cup boarball onto our existing arena/fiesta system per the
// ticket's own instruction. Scope cut from upstream, disclosed on the ticket:
//   - no nations/kits/roles/keeper (upstream's 8 banner nations + 4 role kits):
//     one flat 3-ability kit for every player, in the pit-sized 2v2 arena format.
//   - no ground-aim targeting (upstream's `targetMode: 'position'`, a client
//     aim-reticle primitive this fork's ability system does not have): Shoot
//     auto-aims at the enemy goal from the caster's position (upstream's own
//     handler already auto-aims Shoot at goal; this fork just skips the extra
//     charge-by-aim-distance nuance), Pass uses the EXISTING friendly-target
//     primitive (requiresTarget + targetType 'friendly') instead of an aim point.
//   - no betting/wagering, no daily-reward hook: SKIP(conflict)/SKIP per the
//     ticket's hard exclusions (docs/plan-the-hollow.md:412, PHAA-518, PHAA-565).
//
// The ball is an inert, non-hostile mob entity (family 'beast', moveSpeed 0,
// aggroRadius 0, ccImmune) with an explicit AI early-bail in
// src/sim/mob/locomotion.ts (the existing `vision_`-prefix precedent) so it
// never engages combat AI; its velocity lives in the match state
// (social/boarball.ts), never on the entity. Sport abilities are class-agnostic
// (AbilityDef.class is a type requirement only; casting gates purely on
// membership in meta.known) and physical/cost-0/off-GCD so every class can play.
import type { AbilityDef, MobTemplate } from '../types';
import type { KnownAbility } from './classes';

export const BOARBALL_MOB_TEMPLATE_ID = 'boarball_ball';

export const BOARBALL_MOBS: Record<string, MobTemplate> = {
  [BOARBALL_MOB_TEMPLATE_ID]: {
    id: BOARBALL_MOB_TEMPLATE_ID,
    name: 'Boarball',
    minLevel: 1,
    maxLevel: 1,
    family: 'beast',
    hpBase: 1,
    hpPerLevel: 0,
    dmgBase: 0,
    dmgPerLevel: 0,
    attackSpeed: 999,
    armorPerLevel: 0,
    moveSpeed: 0,
    aggroRadius: 0,
    loot: [],
    scale: 0.65,
    color: 0xf4f4f4,
    ccImmune: true,
  },
};

// Sport abilities. All school 'physical' (resolve on the cast tick, skip spell
// resist), cost 0, offGcd (so kicks never queue behind the GCD).
export const SPORT_ABILITIES: Record<string, AbilityDef> = {
  sport_shoot: {
    id: 'sport_shoot',
    name: 'Shoot',
    class: 'warrior',
    learnLevel: 1,
    cost: 0,
    castTime: 0,
    cooldown: 1.4,
    range: 0,
    school: 'physical',
    requiresTarget: false,
    offGcd: true,
    effects: [{ type: 'ballShoot', power: 22, loft: 6 }],
    description: 'Strike the ball toward the enemy goal.',
  },
  sport_pass: {
    id: 'sport_pass',
    name: 'Pass',
    class: 'warrior',
    learnLevel: 1,
    cost: 0,
    castTime: 0,
    cooldown: 1,
    range: 40,
    school: 'physical',
    requiresTarget: true,
    targetType: 'friendly',
    offGcd: true,
    effects: [{ type: 'ballPass', power: 18, loft: 0 }],
    description: 'Roll a firm pass to your targeted teammate.',
  },
  sport_boost: {
    id: 'sport_boost',
    name: 'Fresh Legs',
    class: 'warrior',
    learnLevel: 1,
    cost: 0,
    castTime: 0,
    cooldown: 12,
    range: 0,
    school: 'physical',
    requiresTarget: false,
    offGcd: true,
    effects: [{ type: 'selfBuff', kind: 'buff_speed', value: 1.5, duration: 4 }],
    description: 'Find your legs: move 50% faster for 4 sec.',
  },
};

export const SPORT_KIT_IDS = ['sport_shoot', 'sport_pass', 'sport_boost'] as const;

/** The one shared sport-kit resolver (self-contained: does not consume the
 *  global ABILITIES table, mirroring how upstream's kit swap works). Flat
 *  rank-1 entries with NO talent modifiers: a player's damage talents must
 *  never scale sport moves, and every class gets the identical kit. */
export function resolveBoarballKit(): KnownAbility[] {
  return SPORT_KIT_IDS.map((id) => {
    const def = SPORT_ABILITIES[id];
    return {
      def,
      rank: 1,
      cost: def.cost,
      castTime: def.castTime,
      cooldown: def.cooldown,
      effects: def.effects,
      threatFlat: 0,
      threatMult: 1,
    };
  });
}
