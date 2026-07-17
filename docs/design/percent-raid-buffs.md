# Percent whole-group raid buffs (PHAA-577)

A deliberate, Board-approved exception to the classic-era flat-buff formula
rule in the root `CLAUDE.md` ("gameplay math follows real classic-era MMO
formulas... don't invent balance numbers"). Upstream world-of-claudecraft PR
#1480 moved seven single-target/self-only flat stat buffs to WotLK-style
percent whole-group auras. This fork's class content had already diverged from
upstream's at the time #1480 landed, so this was NOT a silent port: PHAA-565
raised it as a Board decision (`port_percent` vs `keep_classic`), and Brandon
approved `port_percent` on 2026-07-16.

## What changed

Two new primitives in `src/sim`:

1. **Whole-group buff delivery.** `AbilityEffect` case `buffTarget` gained an
   optional `party?: boolean` flag (`src/sim/types.ts`). When set, the aura
   lands on the caster, the explicit target (if any), and every living member
   of the caster's party/raid, regardless of range (`src/sim/combat/
   effect_dispatch.ts`). Previously every stat buff in this fork was either
   single-target (`buffTarget`, no `party` flag) or self-only (`selfBuff`);
   there was no whole-group delivery mechanism at all.
2. **Percent stat auras.** Four new `AuraKind`s: `buff_ap_pct`, `buff_sta_pct`,
   `buff_armor_pct`, `buff_int_pct`. The value is an INTEGER PERCENT POINT (5 =
   +5%), not a 0..1 fraction, because `applyTalentMods`'s `buffPct` talent fold
   does `Math.round(value * mul)` (see `src/sim/content/classes.ts`); a
   fractional value like 0.05 rounds to 0 under most talent multipliers.
   Folded into `recalcPlayerStats` (`src/sim/entity.ts`) as a percent of the
   already-flat-and-item-buffed stat, alongside the existing talent
   `armorPct`/`apPct`/`staPct`/`intPct` multipliers.

Companion armor-debuff conversion: Sunder Armor, Expose Armor, and Faerie Fire
moved from a flat armor subtraction to a percent reduction (new `AuraKind`
`debuff_armor_pct`, new `AbilityEffect` case `armorDebuffPct`). This is a
SEPARATE `AuraKind` from the existing flat `sunder`, deliberately, so mob
corrosion (`src/sim/mob/mob_swing.ts` `applyCorrosion`, which shares the flat
`sunder` kind and whose `value` is a flat armor number) is entirely unaffected.

## Seven abilities converted

Mapped onto OUR class content (not upstream's, which differs), with our own
percent values (not upstream's WotLK numbers):

| Ability | Class | Was | Now |
|---|---|---|---|
| Battle Shout | Warrior | self-only flat AP 20/35/50 | party AP% 5/8/10 |
| Commanding Shout | Warrior | self-only flat Stamina 6/11 | party Stamina% 5/8 |
| Blessing of Might | Paladin | single-target flat AP 15/30/45 | party AP% 4/7/10 |
| Devotion Aura | Paladin | self-only flat armor 40/75/110 | party armor% 5/8/10 |
| Power Word: Fortitude | Priest | single-target flat Stamina 3/7/12 | party Stamina% 3/6/10 |
| Mark of the Wild | Druid | single-target flat armor 25/50/75 | party armor% 5/8/10 |
| Arcane Intellect | Mage | self-only flat Intellect 2/7 | party Intellect% 3/8 |

Devotion Aura is a 7th ability beyond the "six" PHAA-565/PHAA-577 called out:
it is the same self-only flat-armor-buff shape as the other six, and leaving
it inconsistent (the only remaining self-only flat stat buff while every
sibling ability became a party-wide percent aura) would read as an oversight
rather than a design choice. Flagged here for visibility, not hidden in the
diff.

Sunder Armor (5 stacks, 2%/3% per rank), Expose Armor (single 12%), and Faerie
Fire (single 3%) keep their existing relative power ordering (derived from
this fork's own prior flat values, not upstream's 2%/10% WotLK numbers).

## Why these specific percents

Not copied from upstream. Each ability's percent-per-rank was derived from
this fork's own PRIOR flat-value ranks scaled proportionally (e.g. Battle
Shout's flat 20/35/50 is roughly +75%/+43% rank-to-rank; its percent curve
5/8/10 follows the same shape), so the relative power ordering this fork had
already tuned is preserved through the flat-to-percent conversion.

## QA

State-validation combat sim + determinism: `tests/percent_raid_buffs.test.ts`.
Parity: no RNG draw-order change (buff/debuff dispatch already drew RNG in the
same places; whole-group iteration adds no new draws). The parity goldens WERE
regenerated (`UPDATE_PARITY=1`) because the changed ability data shifts the
`state` hashes; the regen diff is `state`-only, with every `rngDigest` and
`draws` count byte-identical across all 48 snapshots (determinism preserved).
Reviewers: architecture-reviewer (SimContext seam, `ctx.entities`/
`ctx.partyOf` reads only, no new mutation of shared state outside `applyAura`),
design owner (Brandon, already approved via PHAA-565).
