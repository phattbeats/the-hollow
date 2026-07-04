# Multiclass resource translation (PHAA-462)

GW1 build-crafting (see `docs/plan-the-hollow.md` sec8) gives a character a
primary and a secondary profession and merges both kits via
`abilitiesKnownAt(cls, level, mods, secondaryCls)`. A character has exactly
one live resource bar (rage, mana, or energy; see `CLASSES[cls].resourceType`
and `entity.ts`), matching the PRIMARY class. Secondary abilities carry their
own `AbilityDef.cost`, denominated in their OWN class's resource type. This
doc proposes the rule for translating that cost onto the player's live pool.

## Scope: cost only, not cast time or cooldown

Per board direction on this ticket: **`castTime` and `cooldown` come over
unchanged** from the secondary ability's definition, subject to the same
haste/stat modifiers that already apply to any ability (`applyTalentMods`,
gear, buffs). They are not a resource and need no translation. This doc's
rule applies only to `AbilityDef.cost`.

## The problem

`cost` is a raw number scaled to the ability's native resource:
- rage and energy pools are always capped at 100 (`baseMana: 100,
  manaPerLevel: 0` for warrior/rogue in `classes.ts`), so a rage/energy
  `cost` is already a plain percentage of its pool.
- mana pools vary by class and level (`baseMana` + `manaPerLevel * level`,
  further modified by intellect), so a mana `cost` is NOT a fixed percentage
  and differs from a level-1 mage to a level-20 priest.

Copying `cost` verbatim breaks the moment the native and live resource types
differ: a mage secondary's 20-mana bolt is trivial against a 20th-level
mage's pool, but a flat 20 against a warrior's 100-cap rage bar is a fifth of
the whole bar for one cast.

## Proposed rule

Translate by **percentage of the ability's native max**, then apply that
percentage to the player's live pool:

```
nativeMax = maxResourceFor(secondaryCls, level)   // same formula recalcPlayerStats
                                                    // already uses for that class/level
costFraction = ability.cost / nativeMax
translatedCost = round(costFraction * player.maxResource)  // live pool, primary class
```

This reuses the existing per-class mana-pool formula (no new balance number
is invented, matching the CLAUDE.md rule against inventing balance math) and
is symmetric: rage/energy costs are already percentages of 100, so this
degenerates to today's plain numbers whenever the secondary shares the
player's live resource type (including rage-to-energy or energy-to-rage,
both capped at 100, which needed no change at all).

Druid forms are exempt: a druid secondary's bear/cat forms are not paid for
out of the live pool, they SWAP it (see `serialize_resource.ts` and
`entity.ts`'s form-shift handling), same as when druid is primary. This rule
only governs ordinary ability costs, not form entry.

## Where this lands

Not implemented in PHAA-462 (data model + persistence only). This is the
design input for the ability-resolution ticket that actually pays costs at
cast time (child of PHAA-461, GW1 build system). Flagging here per the
ticket's ask to "propose and document the resource-translation rule" before
that ticket's implementation starts.
