import {
  ALL_CLASSES,
  type ArmorType,
  type EquipSlot,
  type ItemDef,
  type PlayerClass,
} from './types';

type WeaponArchetype = 'warrior' | 'caster' | 'rogue';

const MAIL_CLASSES = new Set<PlayerClass>(['warrior', 'paladin', 'shaman']);
const LEATHER_CLASSES = new Set<PlayerClass>(['druid', 'rogue', 'hunter']);
const WARRIOR_WEAPON_CLASSES = new Set<PlayerClass>([
  'warrior',
  'rogue',
  'hunter',
  'shaman',
  'paladin',
]);
const CASTER_WEAPON_CLASSES = new Set<PlayerClass>([
  'mage',
  'priest',
  'warlock',
  'shaman',
  'paladin',
  'druid',
]);
const ROGUE_WEAPON_CLASSES = new Set<PlayerClass>(['rogue', 'hunter']);

const ARMOR_RANK: Record<ArmorType, number> = {
  cloth: 0,
  leather: 1,
  mail: 2,
};

// True when `classes` names exactly the members of `allowed` (order-independent).
function sameClassSet(classes: readonly PlayerClass[], allowed: ReadonlySet<PlayerClass>): boolean {
  return classes.length === allowed.size && classes.every((cls) => allowed.has(cls));
}

export function armorTypeForItem(item: ItemDef): ArmorType | null {
  if (item.kind !== 'armor') return null;
  return item.armorType;
}

// Resolve the concrete equipment key an item equips into. In this fork the
// item's declared slot IS the equipment key (no 'ring' slot kind; mainhand is
// the only weapon slot). Returns null for slotless items.
export function resolveEquipSlot(
  item: ItemDef,
  _equipment: Partial<Record<EquipSlot, string>>,
): EquipSlot | null {
  return item.slot ?? null;
}

// Whether a concrete equipment key can hold `item`, i.e. whether an aimed slot
// (a paperdoll drop target) is legal for the dragged piece. The item's slot
// IS its one equipment key, so the check is a direct equality on the typed
// EquipSlot union. Slotless items (consumables, materials) accept nothing.
// This is the ONE rule the equip path and the HUD drop target share, so the
// client's hover feedback and the server's re-validation can never disagree.
export function slotAcceptsItem(item: ItemDef, slot: EquipSlot): boolean {
  return item.slot === slot;
}

export function maxArmorTypeForClass(cls: PlayerClass): ArmorType {
  if (MAIL_CLASSES.has(cls)) return 'mail';
  if (LEATHER_CLASSES.has(cls)) return 'leather';
  return 'cloth';
}

// A weapon's `requiredClass` lists exactly the classes that can equip it, i.e. the
// full weapon-proficiency group (weapons are proficiency-based, not class-locked).
// Recover the archetype by matching that list against each group. A weapon with a
// narrower, bespoke class lock (not one of the three groups) has no archetype and
// falls through to the literal `requiredClass` check in canEquipItem, and shows its
// class line on the tooltip.
export function weaponArchetypeForItem(item: ItemDef): WeaponArchetype | null {
  if (item.kind !== 'weapon' || !item.requiredClass) return null;
  if (sameClassSet(item.requiredClass, WARRIOR_WEAPON_CLASSES)) return 'warrior';
  if (sameClassSet(item.requiredClass, CASTER_WEAPON_CLASSES)) return 'caster';
  if (sameClassSet(item.requiredClass, ROGUE_WEAPON_CLASSES)) return 'rogue';
  return null;
}

// Every class that `canEquipItem` admits for a given armor weight, i.e. every
// class whose max armor rank is at least `armorType`'s rank. Used to tell a
// genuinely enforced armor class list (one that names exactly this set, e.g. mail
// naming only warrior/paladin/shaman) apart from `requiredClass` values that are
// narrower loot-targeting metadata `canEquipItem` never reads (armor short-circuits
// on weight before it would reach `requiredClass`).
export function classesThatCanEquipArmorType(armorType: ArmorType): PlayerClass[] {
  const rank = ARMOR_RANK[armorType];
  return ALL_CLASSES.filter((cls) => ARMOR_RANK[maxArmorTypeForClass(cls)] >= rank);
}

export function canEquipItem(cls: PlayerClass, item: ItemDef): boolean {
  const armorType = armorTypeForItem(item);
  if (armorType) return ARMOR_RANK[armorType] <= ARMOR_RANK[maxArmorTypeForClass(cls)];
  const weaponArchetype = weaponArchetypeForItem(item);
  if (weaponArchetype === 'warrior') return WARRIOR_WEAPON_CLASSES.has(cls);
  if (weaponArchetype === 'caster') return CASTER_WEAPON_CLASSES.has(cls);
  if (weaponArchetype === 'rogue') return ROGUE_WEAPON_CLASSES.has(cls);
  if (item.requiredClass) return item.requiredClass.includes(cls);
  return true;
}
