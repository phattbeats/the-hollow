import { hitFractionFromRating } from './combat/hit_rating';
import type { TalentModifiers } from './content/talents';
import { aggregateSetBonuses, CLASSES, ENCHANTS, ITEMS, MOBS, type NpcDef } from './data';
import { pvpFractionsFromRatings } from './pvp';
import type { Entity, EquipSlot, MobTemplate, PlayerClass, Stats, Vec3 } from './types';
import { EQUIP_SLOTS, SPELL_POWER_PER_INT } from './types';

function baseEntity(id: number, pos: Vec3): Entity {
  return {
    id,
    kind: 'mob',
    templateId: '',
    name: '',
    level: 1,
    pos: { ...pos },
    prevPos: { ...pos },
    facing: 0,
    prevFacing: 0,
    vx: 0,
    vz: 0,
    vy: 0,
    onGround: true,
    jumping: false,
    fallStartY: pos.y,
    hp: 1,
    maxHp: 1,
    resource: 0,
    maxResource: 0,
    resourceType: null,
    overheadEmoteId: null,
    overheadEmoteUntil: 0,
    overheadEmoteSeq: 0,
    stats: {
      str: 0,
      agi: 0,
      sta: 0,
      int: 0,
      spi: 0,
      armor: 0,
      pvpOffense: 0,
      pvpDefense: 0,
    },
    weapon: { min: 1, max: 2, speed: 2 },
    attackPower: 0,
    rangedPower: 0,
    spellPower: 0,
    meleeHaste: 0,
    rangedHaste: 0,
    spellHaste: 0,
    critChance: 0.05,
    critDmgSpellBonus: 0,
    critDmgPhysBonus: 0,
    critDmgHealBonus: 0,
    dodgeChance: 0.05,
    hitRating: 0,
    hitBonus: 0,
    castPushbackReduction: 0,
    moveSpeed: 7,
    hostile: false,
    targetId: null,
    autoAttack: false,
    swingTimer: 0,
    inCombat: false,
    combatTimer: 99,
    auras: [],
    stealthed: false,
    ccDr: new Map(),
    castingAbility: null,
    castRemaining: 0,
    castTotal: 0,
    channeling: false,
    channelTickTimer: 0,
    channelTickEvery: 0,
    gcdRemaining: 0,
    cooldowns: new Map(),
    queuedOnSwing: null,
    queuedCastAbility: null,
    fiveSecondRule: 99,
    comboPoints: 0,
    comboTargetId: null,
    overpowerUntil: -1,
    potionCooldownUntil: -1,
    potionCooldownRemaining: 0,
    savedMana: 0,
    chargeTargetId: null,
    chargeTimeLeft: 0,
    chargePath: [],
    followTargetId: null,
    sitting: false,
    eating: null,
    drinking: null,
    aiState: 'idle',
    tappedById: null,
    pulseTimer: 0,
    stompTimer: 0,
    stoneskinTimer: 0,
    terrifyTimer: 0,
    bigCastTimer: 0,
    aoeSlowTimer: 0,
    loudYellTimer: 0,
    loudYellIndex: 0,
    detonateTimer: Infinity,
    mendTimer: 0,
    wardTimer: 0,
    channelTimer: 0,
    channelRamp: 0,
    rallyTimer: 0,
    warcryTimer: 0,
    firedSummons: 0,
    summonedIds: [],
    enraged: false,
    healedThisPull: false,
    threat: new Map(),
    forcedTargetId: null,
    forcedTargetTimer: 0,
    ownerId: null,
    petMode: 'defensive',
    petTauntTimer: 0,
    petPath: [],
    petPathCooldown: 0,
    spawnPos: { ...pos },
    leashAnchor: null,
    evadeStall: 0,
    fleeTimer: 0,
    fleeReturnTimer: 0,
    hasFled: false,
    wanderTarget: null,
    wanderTimer: 0,
    aggroTargetId: null,
    respawnTimer: 0,
    corpseTimer: 0,
    lootFfaTimer: Infinity, // no FFA countdown until rollLoot starts it at death
    harvestClaimedBy: null,
    lootable: false,
    loot: null,
    xpValue: 0,
    questIds: [],
    vendorItems: [],
    objectItemId: null,
    dungeonId: null,
    dead: false,
    scale: 1,
    color: 0xffffff,
    skinCatalog: 'class',
    skin: 0,
    sex: 'm',
    mainhandItemId: null,
    equippedItems: {},
    guild: '',
  };
}

export function createPlayer(id: number, cls: PlayerClass, pos: Vec3, name: string): Entity {
  const def = CLASSES[cls];
  const e = baseEntity(id, pos);
  e.kind = 'player';
  e.templateId = cls;
  e.name = name;
  e.level = 1;
  e.resourceType = def.resourceType;
  e.color = def.color;
  return e;
}

export type PlayerEquipment = Partial<Record<EquipSlot, string>>;

// Vanilla rules: first 20 stamina gives 1 hp each, the rest 10 hp each.
// First 20 intellect gives 1 mana each, the rest 15 mana each.
function hpFromStamina(sta: number): number {
  // Floor at 0 so a Stamina-draining debuff (negative buff_sta) can never push
  // the HP pool below its level-based base into negative territory.
  const s = Math.max(0, sta);
  return Math.min(s, 20) + Math.max(0, s - 20) * 10;
}
function manaFromIntellect(int: number): number {
  // Floor at 0 so an Intellect-draining debuff (negative buff_int) can never push
  // the mana pool below its level-based base into negative territory.
  const i = Math.max(0, int);
  return Math.min(i, 20) + Math.max(0, i - 20) * 15;
}

// Stat-neutral resource ceiling for a class at a level: the same baseMana/
// manaPerLevel curve recalcPlayerStats uses, but WITHOUT the live player's
// intellect term (rage/energy always cap at 100). Used to translate a
// secondary-kit ability's cost onto the player's own live pool (multiclass
// resource translation, PHAA-467): the fraction of the secondary class's bar
// an ability costs must stay the same regardless of the primary class's
// stats, so this deliberately ignores the caster's actual Intellect.
export function nativeMaxResource(cls: PlayerClass, level: number): number {
  const def = CLASSES[cls];
  if (def.resourceType !== 'mana') return 100;
  return def.baseMana + def.manaPerLevel * (level - 1);
}

// Recompute all derived stats for the player from class, level, gear, buffs, and
// precomputed talent modifiers. `mods` is the flat struct resolved at
// allocation/respec time (computeTalentModifiers) — this never walks the tree.
// `enchants` (PHAA-649 child, upstream #1712) is the player's active
// per-equip-slot enchant ids (meta.enchants); optional so every existing
// caller keeps compiling unchanged, but omitting it silently drops any
// enchant bonus, so pass it through wherever `meta`/`r.meta` is in scope.
export function recalcPlayerStats(
  e: Entity,
  cls: PlayerClass,
  equipment: PlayerEquipment,
  mods?: TalentModifiers,
  enchants?: Partial<Record<EquipSlot, string>>,
): void {
  const def = CLASSES[cls];
  const lvl = e.level;
  const s: Stats = {
    str: def.baseStats.str + def.statsPerLevel.str * (lvl - 1),
    agi: def.baseStats.agi + def.statsPerLevel.agi * (lvl - 1),
    sta: def.baseStats.sta + def.statsPerLevel.sta * (lvl - 1),
    int: def.baseStats.int + def.statsPerLevel.int * (lvl - 1),
    spi: def.baseStats.spi + def.statsPerLevel.spi * (lvl - 1),
    armor: def.baseStats.armor + def.statsPerLevel.armor * (lvl - 1),
    pvpOffense: 0,
    pvpDefense: 0,
  };
  const setCounts = new Map<string, number>();
  let bonusSp = 0; // flat Spell Power from gear affixes + buff_spellpower auras
  let bonusHitRating = 0;
  let bonusPvpOffenseRating = 0;
  let bonusPvpDefenseRating = 0;
  for (const slot of EQUIP_SLOTS) {
    const itemId = equipment[slot];
    if (!itemId) continue;
    const item = ITEMS[itemId];
    if (!item) continue;
    if (item.set) setCounts.set(item.set, (setCounts.get(item.set) ?? 0) + 1);
    bonusSp += item.spellPower ?? 0;
    bonusHitRating += item.hitRating ?? 0;
    bonusPvpOffenseRating += item.pvpOffenseRating ?? 0;
    bonusPvpDefenseRating += item.pvpDefenseRating ?? 0;
    if (item.stats) {
      s.str += item.stats.str ?? 0;
      s.agi += item.stats.agi ?? 0;
      s.sta += item.stats.sta ?? 0;
      s.int += item.stats.int ?? 0;
      s.spi += item.stats.spi ?? 0;
      s.armor += item.stats.armor ?? 0;
    }
    // Enchanting (PHAA-649 child, upstream #1712): the enchant lives on the
    // SLOT (not a specific item copy; see src/sim/enchanting.ts), so its
    // bonus only applies while that slot is occupied, same as gear stats.
    const enchantId = enchants?.[slot];
    const enchant = enchantId && ENCHANTS.find((en) => en.id === enchantId);
    if (enchant) {
      s.str += enchant.stats.str ?? 0;
      s.agi += enchant.stats.agi ?? 0;
      s.sta += enchant.stats.sta ?? 0;
      s.int += enchant.stats.int ?? 0;
      s.spi += enchant.stats.spi ?? 0;
      s.armor += enchant.stats.armor ?? 0;
    }
  }
  // Item-set bonuses from equipped pieces. Flat primary stats join the gear
  // totals so they feed every derivation below; AP/crit/pushback fold in at
  // their own steps (bonusAp, critChance, castPushbackReduction).
  const setEff = aggregateSetBonuses(setCounts);
  s.str += setEff.str;
  s.agi += setEff.agi;
  s.sta += setEff.sta;
  s.int += setEff.int;
  s.spi += setEff.spi;
  // Buff auras
  let bonusAp = setEff.ap;
  let bonusDodge = 0;
  let bearForm = false;
  let catForm = false;
  let moonkinForm = false;
  let scaleMul = 1; // Fiesta buff_scale: body-size multiplier (>1 also adds hp)
  // PHAA-577 percent raid buffs: integer percent points (5 = +5%), summed across
  // every source then folded as a percent-of-the-fully-summed-stat below,
  // alongside the existing talent stat-percent multipliers.
  let apPctBuff = 0;
  let staPctBuff = 0;
  let intPctBuff = 0;
  let armorPctBuff = 0;
  for (const a of e.auras) {
    if (a.kind === 'buff_ap') bonusAp += a.value;
    else if (a.kind === 'buff_ap_pct') apPctBuff += a.value / 100;
    else if (a.kind === 'buff_sta_pct') staPctBuff += a.value / 100;
    else if (a.kind === 'buff_int_pct') intPctBuff += a.value / 100;
    else if (a.kind === 'buff_armor_pct') armorPctBuff += a.value / 100;
    // Attack-power debuff (Demoralizing Shout/Roar). Mobs fold this live in
    // effectiveAttackPower; players bake it here, so without this arm the debuff
    // was a no-op versus enemy players (PvP).
    else if (a.kind === 'debuff_ap') bonusAp -= a.value;
    else if (a.kind === 'buff_armor') s.armor += a.value;
    else if (a.kind === 'buff_int') s.int += a.value;
    else if (a.kind === 'buff_agi') s.agi += a.value;
    else if (a.kind === 'buff_spi') s.spi += a.value;
    else if (a.kind === 'buff_sta') s.sta += a.value;
    else if (a.kind === 'buff_allstats') {
      s.str += a.value;
      s.agi += a.value;
      s.sta += a.value;
      s.int += a.value;
      s.spi += a.value;
    } else if (a.kind === 'buff_spellpower') bonusSp += a.value;
    else if (a.kind === 'buff_dodge') bonusDodge += a.value;
    else if (a.kind === 'buff_scale') scaleMul *= a.value;
    // Metamorphosis: a temporary demon transform that also makes the caster larger.
    else if (a.kind === 'form_metamorph') scaleMul *= 1.35;
    else if (a.kind === 'form_bear') bearForm = true;
    else if (a.kind === 'form_cat') catForm = true;
    // Moonwing Form carries its Spell Power bonus in the form aura's value, so it lives
    // and dies with the one toggle. Gloamveil Form (form_shadow) is NOT a Spell Power
    // buff: it amplifies Shadow-school DAMAGE by a percent, applied in combat/damage.ts,
    // so it contributes nothing to the stat pass here.
    else if (a.kind === 'form_moonkin') {
      bonusSp += a.value;
      moonkinForm = true;
    }
  }
  // Talent passive stat modifiers (flat additions + a stamina percent before the
  // HP derivation below). AP/armor/maxHp percents are applied at their own steps.
  if (mods) {
    const m = mods.stats;
    s.str += m.str;
    s.agi += m.agi;
    s.sta += m.sta;
    s.int += m.int;
    s.spi += m.spi;
    s.armor += m.armor;
    bonusAp += m.ap;
    bonusDodge += m.dodge;
    // Primary-attribute multipliers, applied to the fully-summed attribute. agiPct lands
    // before the agi-derived armor/dodge below so the percentage flows into them.
    if (m.strPct) s.str = Math.round(s.str * (1 + m.strPct));
    if (m.agiPct) s.agi = Math.round(s.agi * (1 + m.agiPct));
    if (m.spiPct) s.spi = Math.round(s.spi * (1 + m.spiPct));
  }
  // Stamina/Intellect percents (talent mod + PHAA-577 raid buff) folded once, guarded
  // independently of `mods` for symmetry with the ap/armor percent folds below, so a
  // percent buff never silently drops when a caller passes no talent mods. Combined in a
  // single Math.round to keep the value byte-identical to the prior in-block fold. Stamina
  // stays before the HP derivation; Intellect before the spell-power derivation.
  {
    const staPct = (mods?.stats.staPct ?? 0) + staPctBuff;
    if (staPct) s.sta = Math.round(s.sta * (1 + staPct));
    const intPct = (mods?.stats.intPct ?? 0) + intPctBuff;
    if (intPct) s.int = Math.round(s.int * (1 + intPct));
  }
  // Floor Agility at 0 so a draining debuff (negative buff_agi) can never push the
  // derived armor/dodge below what zero Agility would give.
  s.agi = Math.max(0, s.agi);
  s.armor += s.agi * 2;
  if (bearForm) {
    s.armor = Math.round(s.armor * 1.9);
    bonusAp += 15 + Math.round(s.agi * 1.5);
  }
  if (catForm) {
    bonusAp += 8 + lvl * 2;
    s.agi += Math.max(2, Math.floor(lvl / 2));
  }
  // Moonwing Form: a hardy caster form that adds 50% armor (its spell damage rides a
  // separate buff_spelldmg-equivalent read in spell_combat.ts's spellDamageMultFromAuras).
  if (moonkinForm) s.armor = Math.round(s.armor * 1.5);
  if (mods?.stats.armorPct || armorPctBuff)
    s.armor = Math.round(s.armor * (1 + (mods?.stats.armorPct ?? 0) + armorPctBuff));
  // Floor Spirit at 0 so a Spirit-siphoning debuff (negative buff_spi) can never
  // drive out-of-combat regen (updateRegen reads stats.spi) below zero.
  s.spi = Math.max(0, s.spi);

  e.stats = s;
  const warfare = pvpFractionsFromRatings(bonusPvpOffenseRating, bonusPvpDefenseRating);
  e.stats.pvpOffense = warfare.offense;
  e.stats.pvpDefense = warfare.defense;
  const weapon = (equipment.mainhand && ITEMS[equipment.mainhand]?.weapon) || {
    min: 1,
    max: 2,
    speed: 2,
  };
  e.weapon = weapon;
  // Render-only: the equipped mainhand item id drives the held weapon model on
  // the client (mapped via ITEM_WEAPON_VARIANTS). Gated on the item actually being
  // a weapon, mirroring the e.weapon derivation above (so a non-weapon mainhand,
  // were one ever stored, never resolves to a held model).
  e.mainhandItemId =
    equipment.mainhand && ITEMS[equipment.mainhand]?.weapon ? equipment.mainhand : null;
  // Render-only mirror of the full worn set, copied so a later mutation of the
  // owning PlayerMeta.equipment never aliases into the entity. Synced in the
  // identity wire (terse `eq`) for the inspect-another-player window.
  e.equippedItems = { ...equipment };
  // Melee AP by class (vanilla-ish): warriors/paladins/shamans/druids 2/str,
  // rogues str+agi, hunters str+agi, pure casters str.
  const apFromStats =
    cls === 'warrior' || cls === 'paladin' || cls === 'shaman' || cls === 'druid'
      ? s.str * 2
      : cls === 'rogue' || cls === 'hunter'
        ? s.str + s.agi
        : s.str;
  // Floor at 0 so a heavy debuff_ap stack can never bake a negative attack power
  // (mirrors effectiveAttackPower's mob floor and the agi/spi floors above).
  e.attackPower = Math.max(
    0,
    Math.round((apFromStats + bonusAp) * (1 + (mods?.stats.apPct ?? 0) + apPctBuff)),
  );
  // Hunters: ranged AP = 2/agi (vanilla)
  e.rangedPower =
    cls === 'hunter'
      ? Math.max(0, Math.round((s.agi * 2 + bonusAp) * (1 + (mods?.stats.apPct ?? 0) + apPctBuff)))
      : 0;
  // Spell Power: Intellect converted via SPELL_POWER_PER_INT plus flat Spell Power
  // from gear/buffs. Floored at 0 so an Intellect-draining debuff can't go negative.
  e.spellPower = Math.max(0, Math.round(s.int * SPELL_POWER_PER_INT + bonusSp));
  // Haste from item-set bonuses. Melee/ranged haste stay set-bonus-only; spell haste
  // also folds in a spec mastery's passive haste (spellHastePct, e.g. Aether Surge's
  // spec), so a caster spec can shorten every cast, spell_combat.ts's spellHasteMult
  // reads this stat plus any live buff_spellhaste auras (Icy Veins, Metamorphosis).
  e.meleeHaste = setEff.haste + (mods?.global.meleeHastePct ?? 0);
  e.rangedHaste = setEff.haste;
  e.spellHaste = setEff.haste + (mods?.global.spellHastePct ?? 0);
  // Crit: ~1% per 20 agi at low level
  e.critChance = 0.05 + s.agi * 0.0005 + (mods?.stats.crit ?? 0) + setEff.crit;
  // Extra crit damage from a spec mastery, per output channel (e.g. Fire mage: SPELL
  // crits deal more; Holy paladin: HEAL crits; Combat rogue: PHYSICAL crits).
  e.critDmgSpellBonus = mods?.global.critDmgSpellPct ?? 0;
  e.critDmgPhysBonus = mods?.global.critDmgPhysPct ?? 0;
  e.critDmgHealBonus = mods?.global.critDmgHealPct ?? 0;
  // Hit rating (gear only today; no set bonus grants it) folds into a hit fraction
  // that combat subtracts from miss (swingMissChance) and spell resist
  // (spell_resist.ts). It answers the Heroic above-level penalty; unlike crit it
  // has no higher-level suppression.
  e.hitRating = bonusHitRating;
  e.hitBonus = hitFractionFromRating(e.hitRating);
  e.castPushbackReduction = setEff.castPushbackReduction;
  // Floored at 0: an off-balance debuff (negative buff_dodge) can drive dodge to nothing.
  e.dodgeChance = Math.max(0, 0.05 + s.agi * 0.0005 + bonusDodge);

  const hpFrac = e.maxHp > 0 ? e.hp / e.maxHp : 1;
  e.maxHp = def.baseHp + def.hpPerLevel * (lvl - 1) + hpFromStamina(s.sta);
  if (bearForm) e.maxHp = Math.round(e.maxHp * 1.15);
  if (mods?.stats.maxHpPct) e.maxHp = Math.round(e.maxHp * (1 + mods.stats.maxHpPct));
  // Fiesta "Colossus"-style buffs: growing bigger also makes you tankier.
  if (scaleMul > 1) e.maxHp = Math.round(e.maxHp * scaleMul);
  e.hp = Math.max(1, Math.round(e.maxHp * hpFrac));
  if (e.dead) e.hp = 0;
  // Body size: players default to 1; a buff_scale aura grows/shrinks them live.
  if (e.kind === 'player') e.scale = scaleMul;

  // Druid forms swap the resource bar, classic-style: bear runs on rage
  // (starts empty, fills from combat), cat on energy (starts full — friendlier
  // than vanilla's 0). Mana is parked in savedMana and restored on shift-out.
  const formResource: 'rage' | 'energy' | null = bearForm ? 'rage' : catForm ? 'energy' : null;
  if (formResource) {
    if (e.resourceType === 'mana') e.savedMana = e.resource;
    if (e.resourceType !== formResource) e.resource = formResource === 'energy' ? 100 : 0;
    e.resourceType = formResource;
    e.maxResource = 100;
  } else if (def.resourceType === 'mana') {
    const cameFromForm = e.resourceType !== 'mana';
    const manaFrac = e.maxResource > 0 ? e.resource / e.maxResource : 1;
    e.resourceType = 'mana';
    e.maxResource = def.baseMana + def.manaPerLevel * (lvl - 1) + manaFromIntellect(s.int);
    e.resource = cameFromForm
      ? Math.min(e.savedMana, e.maxResource)
      : Math.round(e.maxResource * manaFrac);
  } else {
    e.resourceType = def.resourceType;
    e.maxResource = 100; // rage and energy both cap at 100
    e.resource = Math.min(e.resource, 100);
  }
}

// Derived stats + max vitals for an OFFLINE character (a stored CharacterState),
// computed by reusing recalcPlayerStats on a throwaway entity rather than
// re-deriving the numbers. With no auras and no active form, recalcPlayerStats
// yields exactly the class/level/gear/talent stat block — the same numbers a
// live player shows — so the character sheet stays in lockstep with the engine.
// Resource max is the full pool for the class (mana from intellect, or 100 for
// rage/energy); the sheet pairs it with the stored current value.
export interface DerivedCharacterStats {
  stats: Stats;
  maxHp: number;
  maxResource: number;
  resourceType: Entity['resourceType'];
}

export function characterDerivedStats(
  cls: PlayerClass,
  level: number,
  equipment: PlayerEquipment,
  mods?: TalentModifiers,
  enchants?: Partial<Record<EquipSlot, string>>,
): DerivedCharacterStats {
  const e = createPlayer(0, cls, { x: 0, y: 0, z: 0 }, '');
  e.level = Math.max(1, Math.floor(level));
  recalcPlayerStats(e, cls, equipment, mods, enchants);
  return {
    stats: e.stats,
    maxHp: e.maxHp,
    maxResource: e.maxResource,
    resourceType: e.resourceType,
  };
}

export function createMob(id: number, template: MobTemplate, level: number, pos: Vec3): Entity {
  const e = baseEntity(id, pos);
  e.kind = 'mob';
  e.templateId = template.id;
  e.name = template.name;
  e.level = level;
  e.hostile = true;
  // Elite scaling, vanilla-style: ~2.3x health, ~1.5x damage.
  const hpMult = template.elite ? 2.3 : 1;
  const dmgMult = template.elite ? 1.5 : 1;
  e.maxHp = Math.round((template.hpBase + template.hpPerLevel * (level - 1)) * hpMult);
  e.hp = e.maxHp;
  const dmg = (template.dmgBase + template.dmgPerLevel * (level - 1)) * dmgMult;
  e.weapon = {
    min: Math.round(dmg * 0.8),
    max: Math.round(dmg * 1.25),
    speed: template.attackSpeed,
  };
  // Armor scales from level 1 like hp/dmg above: a template has no armorBase,
  // so a level-1 mob gets 0 and each level adds armorPerLevel.
  e.stats.armor = Math.round(template.armorPerLevel * (level - 1));
  e.moveSpeed = template.moveSpeed;
  e.scale = template.scale;
  e.color = template.color;
  e.swingTimer = 0;
  // Telegraph the first War Stomp: delay it one full interval after engage.
  if (template.stomp) e.stompTimer = template.stomp.every;
  // Telegraph the first Banshee's Wail the same way: one full interval after engage.
  if (template.terrify) e.terrifyTimer = template.terrify.every;
  // Telegraph the first Mend the same way: one full interval after engage.
  if (template.mendAlly) e.mendTimer = template.mendAlly.every;
  // Telegraph the first Ward the same way: one full interval after engage.
  if (template.wardAllies) e.wardTimer = template.wardAllies.every;
  // Telegraph the first channeled heal tick: one full interval after engage.
  if (template.channelHeal) e.channelTimer = template.channelHeal.every;
  // Telegraph the first Stoneskin: one full interval after engage.
  if (template.stoneskin) e.stoneskinTimer = template.stoneskin.every;
  // Telegraph the first Rally the same way: one full interval after engage.
  if (template.rally) e.rallyTimer = template.rally.every;
  // Telegraph the first War Cadence the same way: one full interval after engage.
  if (template.warcry) e.warcryTimer = template.warcry.every;
  // Telegraph the first anti-kite snare the same way: one full interval after engage.
  if (template.aoeSlow) e.aoeSlowTimer = template.aoeSlow.every;
  // Telegraph the first battle-cry bark the same way: one full interval after engage.
  if (template.battleYells) e.loudYellTimer = template.battleYells.every;
  // Telegraph the first telegraphed hardcast the same way: one full interval after engage.
  if (template.bigCast) e.bigCastTimer = template.bigCast.every;
  return e;
}

export function createNpc(id: number, def: NpcDef, pos: Vec3): Entity {
  const e = baseEntity(id, pos);
  e.kind = 'npc';
  e.templateId = def.id;
  e.name = def.name;
  e.level = 10;
  e.hostile = false;
  e.maxHp = 500;
  e.hp = 500;
  e.facing = def.facing;
  e.prevFacing = def.facing;
  e.color = def.color;
  e.questIds = [...def.questIds];
  e.vendorItems = [...(def.vendorItems ?? [])];
  return e;
}

export function createGroundObject(id: number, itemId: string, name: string, pos: Vec3): Entity {
  const e = baseEntity(id, pos);
  e.kind = 'object';
  e.templateId = `ground_${itemId}`;
  e.name = name;
  e.level = 1;
  e.hostile = false;
  e.maxHp = 1;
  e.hp = 1;
  e.objectItemId = itemId;
  e.lootable = true;
  return e;
}

export { MOBS };
