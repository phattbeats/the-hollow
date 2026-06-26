# Graphics and performance settings are gameplay-neutral

Status: principle adopted; implemented for the HUD effect tiers in frontend-modernization
v0.16.0 (P14a + the 2026-06-26 fairness re-audit). One known open gap remains (see "Open
issue" below), tracked with a ready-to-run remediation prompt in the appendix.

## The principle

A player's graphics / performance preset must never give them a competitive ADVANTAGE or a
DISADVANTAGE. The simulation is identical for every client (the server is authoritative; the
client is a renderer), so two players on different presets must have the same information to
act on. A graphics tier may shed COSMETIC richness; it must never change ACTIONABLE
information.

ACTIONABLE (must be identical across every tier; never tiered):
- Your own debuffs. You must see a DoT, curse, CC, or move-out mechanic to react, and there
  is no self-dispel, so the aura icon is the only read.
- Party / raid member HP. A healer reacts to it directly.
- The target / boss cast bar. Interrupt timing depends on it.
- Target HP at a usable granularity (execute thresholds, is-it-dead).
- Enemy / aggro positions a player acts on.

COSMETIC (may be tiered down on lower presets):
- Floating combat text volume, lifetime, and non-crit damage numbers. The numbers are
  redundant with the HP bars and the combat log, and the damage itself is server-resolved.
- Minimap redraw smoothness. It is a coarse overview; the 3D world and nameplates carry the
  same signal at full rate.
- Buff-icon overflow when the bar is full. A buff is active whether or not its icon is on
  screen, so hiding a buff icon removes no actionable information.
- Portrait and HP-bar redraw smoothness within human reaction tolerance (about 200 ms).

The test for any new tier knob: if a knob hides or delays something a player READS AND REACTS
TO, it is not allowed. If it only reduces visual richness or redraw smoothness, it is fine.

## Current implementation (frontend-modernization v0.16.0)

The HUD effect tier is the player's STATIC graphics preset (`data-fx-level`, resolved by
`src/game/ui_effects_profile.ts`), never the FPS auto-governor. Per-element knobs live in
`src/game/ui_tier_knobs.ts`. Only the `low` tier sheds; medium / high / ultra are
byte-equivalent to pre-tiering.

What each knob does, and why it is gameplay-neutral:

- FCT (floating combat text), `src/ui/fct_painter.ts`: on low, caps live floaters, shortens
  their lifetime, and drops non-crit DAMAGE NUMBERS only (scoped via
  `fct_core.isDamageFctKind`, so crits, xp, the cannot-move self-note, heals, and miss / dodge
  words are all kept). Cosmetic: server-authoritative damage is unchanged and the HP bars and
  combat log carry the numbers at full rate.
- Minimap, `src/ui/minimap_painter.ts` + the hud cadence gate: on low, redraws at about 4 Hz
  instead of 10 Hz. Cosmetic: the minimap never draws enemy players (only PvE aggro mobs and
  allies), and the same aggro signal is full-rate in the 3D world and on nameplates.
- Auras, `src/ui/auras_painter.ts`: on low, the visible-count cap is DEBUFF-PRIORITY. The
  player buff bar (`createAurasView('all')`) interleaves buffs and debuffs in sim-application
  order; the cap sheds BUFF overflow only (`if (!s.isDebuff && rendered >= cap) continue`), so
  a debuff is never culled. Full tiers are byte-identical (cap is +Infinity). The aura strip
  also coarsens its repaint cadence to about 4 Hz on low (at the human reaction floor and the
  same rate the party frames run at on every tier).
- Target frame, hud + `unit_frame_painter.ts`: on low, the target frame BODY (HP / level /
  portrait) refreshes at about 10 Hz; a target SWAP bypasses the throttle
  (`nonSelfRepaintDue`), and the cast bar is painted OUTSIDE the throttle (full rate, so
  interrupt timing is never degraded). Cosmetic: 100 ms is below the reaction loop and target
  HP is a coarse read.
- Party frames: deliberately NOT tiered. Party-member HP is a healer's only actionable signal,
  so it stays on the 4 Hz mediumHud band for EVERY tier. (An earlier draft throttled it to
  2 Hz on low; the re-audit removed that. The perf win was illusory anyway, because
  `updatePartyFrames` already short-circuits an unchanged party via its HP-bearing signature.)

### The 2026-06-26 fairness re-audit

A senior re-audit (a five-dimension adversarial review plus a coverage reviewer) found that the
original P14a, while correct and spec-compliant, had drafted two gameplay-relevant sheds. Both
were fixed:

1. The aura cap was a flat first-N cap that could hide a player debuff past slot 8 on low while
   every other tier showed it. Now debuff-priority (never culls a debuff).
2. The party-frame 2 Hz throttle delayed a healer's HP reaction on the preset large-raid players
   pick. Removed; party HP is full-rate on every tier.

Commits on `feature/frontend-modernization-v016`: `8aba739d` (aura debuff-priority cap),
`ae619faf` (party full-rate + the `nonSelfRepaintDue` swap-bypass), `82721b18` (minimap token
cache), `119b47fa` (FCT drop-kind uniformity test), `4915b6b7` (docs).

## Enforcing guards

- `tests/auras_painter.test.ts`: a debuff past the buff cap still renders; an all-debuff bar
  exceeds the cap; the cap is byte-identical on full tiers.
- `tests/ui_tier_knobs.test.ts`: the LOW shed constants are literal-pinned; a `Hud.fxTier()`
  source-scan proves the knobs read the static `data-fx-level` stamp and never the FPS
  governor; a source-scan pins that party frames are not tiered.
- `tests/architecture.test.ts`: `ui_tier_knobs.ts` is a registered UI_PURE_CORE (no governor,
  DOM, or render import).
- `scripts/perf_tour.mjs` per-tier run: `hudHotDomWrites` pinned across tiers (byte-equivalence)
  and the FCT cap engaging per tier.

## Open issue: negative-value stat-sap auras read as buffs online

ONE residual gap remains, and it predates P14a. A negative-value `buff_*` stat-sap aura (an
attack-power or intellect drain that rides a `buff_*` kind with a negative value) is classified
as a debuff by `src/ui/auras_view.ts` `isAuraDebuff` only OFFLINE. The online wire does not send
the aura value: `WireAura` (`server/game.ts:224`) omits it, and the client decode hardcodes
`value: 0` (`src/net/online.ts:1164`). So online, `isAuraDebuff`'s `value < 0` branch never
fires, the sap reads as a buff, and on the LOW preset it can therefore ride the buff budget and
be hidden past the cap.

Scope and severity: online only, low preset only, and only for the rare negative-value stat-sap
aura class (a stat drain, not a CC or a move-out mechanic). Every allowlisted debuff KIND (dot,
stun, silence, sunder, and the rest of `DEBUFF_AURA_KINDS`) is value-independent and already
classifies correctly online, because the kind is on the wire. This same gap also makes the
debuff BORDER on such a sap offline-only, a pre-existing visual parity bug, not introduced by
the graphics tiers.

This is the only place a graphics preset can still affect actionable information. Closing it is
a wire / parity change (server + net + a parity test), a different subsystem than the
presentation-only tiering work, so it is tracked here rather than folded into P14a.

## Remediation

Run the appendix prompt in a fresh session. The fix sends the aura value over the wire so
`isAuraDebuff` classifies identically online and offline; the UI keeps ownership of the
classification (it just receives the input it was missing). This also closes the pre-existing
offline-only debuff-border parity bug for stat-saps.

## Appendix: Opus 4.8 prompt to close the wire gap

Paste the block below into a new Claude Code session.

```
Close the aura debuff wire-parity gap so a graphics/performance preset can never hide an
actionable debuff. This is a small server + net + parity fix (NOT a presentation change).

Model: Opus 4.8, xhigh effort. Harness: Claude Code.
Worktree: /Users/fernando/Documents/wocc-v0.16.0 (branch feature/frontend-modernization-v016,
off release/v0.16.0). Commit to that branch unless you decide a fix/ branch is cleaner; this is
a server/net wire change, so treat it as such (it is not part of the presentation packet).

BACKGROUND (verify before changing anything):
- src/ui/auras_view.ts isAuraDebuff(aura) = DEBUFF_AURA_KINDS.has(aura.kind) ||
  (aura.kind.startsWith('buff_') && aura.value < 0). The KIND half works in both worlds (kind
  is on the wire). The value half is OFFLINE-ONLY because online aura.value is always 0.
- server/game.ts: interface WireAura (around line 224) is { id, name, kind, rem, dur, stacks? }
  with NO value; the entity serializer (around line 300) maps each sim aura to WireAura and
  drops value.
- src/net/online.ts (around line 1162) decodes a wire aura and hardcodes value: 0 (also
  sourceId: 0, school: 'physical', which are SEPARATE pre-existing simplifications: do NOT
  touch them in this change).
- Net effect: a negative-value buff_* stat-sap (an AP/int drain) reads as a buff online, so on
  the LOW graphics preset the debuff-priority aura cap (src/ui/auras_painter.ts) can hide it.

GOAL: make isAuraDebuff classify a stat-sap identically online and offline by giving the UI the
input it is missing (the aura value), so no graphics preset can hide an actionable debuff and
the debuff border is consistent across worlds. Keep the classification in the UI (the wire just
carries the data); do NOT move DEBUFF_AURA_KINDS into the server.

PLAN (test-first):
1. Reproduce: add or extend a parity test (tests/auras_view.test.ts already has the cross-world
   parity block) that builds a Sim aura { kind: 'buff_ap', value: -50, ... } and its
   ClientWorld mirror (the shape src/net/online.ts produces) and asserts BOTH classify
   isAuraDebuff === true (and, if you exercise the painter, that the low cap does not cull it).
   It should FAIL today on the mirror.
2. Send value on the wire. Add value to WireAura (server/game.ts) and to the serializer map.
   Prefer a SPARSE encoding to keep the common case free: only send it when it changes the
   classification, e.g. ...(a.value < 0 ? { value: round2(a.value) } : {}). (Full value is also
   acceptable if you prefer; grep first to confirm nothing else online consumes aura.value, so
   you do not change other behavior.)
3. Decode it on the client: in src/net/online.ts, replace value: 0 with value: a.value ?? 0.
   Leave sourceId and school as they are.
4. Update the isAuraDebuff JSDoc in src/ui/auras_view.ts to remove the OFFLINE-ONLY caveat (the
   value < 0 branch now works in both worlds).
5. Make the failing parity test pass. Confirm the low-tier aura cap now keeps such a sap (extend
   the auras_painter or auras_view test as needed).

INVARIANTS YOU MUST KEEP:
- Server stays authoritative; this only changes what the snapshot CARRIES, not any outcome.
- src/sim purity is untouched (tests/architecture.test.ts). The change is in server/ + src/net/
  + a UI doc comment + tests; no sim/render/ui logic moves.
- Sim-vs-ClientWorld parity: after the change, a Sim aura and its wire mirror must derive the
  SAME isAuraDebuff for every case (allowlisted kinds AND the value<0 sap). This is the whole
  point; assert it.
- Wire compatibility: value is an OPTIONAL field, so an old client tolerates a new server and a
  new client tolerates an old server (treat a missing value as 0). Keep it backward-compatible.
- i18n: no new player strings. ASCII only: no em dashes, en dashes, or emojis.
- Shared worktree: stage with EXPLICIT paths, never git add -A.

VALIDATION + REVIEW:
- npx tsc --noEmit; biome check on the changed .ts; the new/updated parity test green; full
  npx vitest run.
- Spawn the cross-platform-sync reviewer (this is a wire/IWorld-parity change, so it fires) and
  the privacy-security-review reviewer (server snapshot surface). Do not commit until no
  BLOCKING.

ACCEPTANCE:
- A negative-value buff_* stat-sap classifies as a debuff in BOTH worlds, so the low-tier aura
  cap never hides it; the debuff border is consistent online and offline; tsc/biome/vitest
  green; cross-platform-sync + privacy-security reviewers report no BLOCKING.
- Update docs/design/graphics-settings-fairness.md: move the "Open issue" section to RESOLVED
  with the commit hash, so the graphics-fairness invariant is then fully enforced.

STOPPING RULES:
- STOP if closing this seems to require moving DEBUFF_AURA_KINDS into the server or sim; the
  classification stays in the UI core. The wire only needs to carry the value.
- STOP if sending value changes any OTHER online behavior (grep aura.value consumers first); if
  so, scope the field to the classification need (sparse negative-only) and note it.
- STOP if the parity test cannot be made to model BOTH world shapes; that modeling is the test.
```
