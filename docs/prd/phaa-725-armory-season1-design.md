# PHAA-725 — Season 1 Armory cosmetic layer (design, pre-implementation)

This is the design pass the ticket asked for before implementation. It owns
the IWorld extension shape, the new persistent state, the season concept,
the HUD panel split, and the gate deltas. No source code in this commit —
only the design, so the review pass is cheap and the implementation can
land in one or two follow-up commits without re-litigating the contract.

The repo's `IWorld` seam is the contract: one facet per file under
`src/world_api/`, a thin `Sim` delegate and a `ClientWorld` mirror, and
the three gates (W0a snapshots, W0b command schema, W0c member parity)
must extend together. This doc names every member the new facet adds and
the gate numbers it shifts.

## Scope, narrow

- Persistent cosmetic loadout outside the event-roll flow.
- A Season 1 concept: a stable id ("s1"), a human label, and a
  season-unlock table. **No expiry / season-end mechanic** in this
  ticket; the v3 plan defers turnover, and PHAA-717 deliberately skips
  the Claudium store. Add only the smallest surface that lets the
  Armory answer "what does this season grant?" and "is X unlocked?"
- A self-contained HUD window module to browse / equip owned skins and
  mech chromas. Not a banner on `hud.ts`.
- Wiring `completedQuestIds[]` to cosmetic unlocks via a static
  quest-to-cosmetic roster (data-as-code in `src/sim/content/skins.ts`'s
  family).

Out of scope (call out so we don't drift):

- The Claudium store / paid currency. PHAA-717 marked it SKIP pending a
  Board call. The Armory talks only to the free / earned cosmetics.
- Season expiry, season-end reward wipe, season-pass tier ladder. The
  Season 1 id is a label; turnover is a future ticket.
- Cross-character / account-wide cosmetics beyond what already exists
  (`accountCosmetics.mechChromaIds[]` is already account-scoped).
- A new "store" or "shop" UI.
- 3D preview changes beyond what the existing `char_window` 3D
  turntable already does.

## The new facet: `IWorldArmory`

Lives at `src/world_api/armory.ts`. Member count: 6 data + 5 methods = 11
new members added to the W0c pinned count (188 -> 199). The facet comment
block in `world_api.ts` will be updated in the implementation commit;
the W0c gate will be re-pinned to the new number in the same change.

### Data members (read from `IWorld`)

| Name | Type | Purpose |
|------|------|---------|
| `armorySeason` | `ArmorySeason` | The active season id + label + start tick; server-truth |
| `armoryUnlocks` | `Map<string, ArmoryUnlockState>` | Per-cosmetic-id unlock state (locked / unlocked / equipped) |
| `armoryLoadout` | `ArmoryLoadout` | Equipped per-class skin index + equipped mech chroma id (free; not from inventory) |
| `armoryCatalog` | `readonly ArmoryCatalogEntry[]` | Static season catalog the UI iterates to render tiles (read-only host-agnostic data) |
| `armoryUnmetRequirements` | `Map<string, string[]>` | Optional: a UI hint map (cosmetic id -> human reason strings) used by the panel to disable tiles; keeps gating logic out of `ui/` |
| `armoryRosterVersion` | `number` | The catalog revision the client is mirroring (server bumps on content updates) |

The five unlock-tied data members answer the UI's questions directly:
"what season?", "what's in this season?", "what have I unlocked?",
"what's on me right now?", "why can't I equip this?". That avoids
bolting the catalog into `src/ui/` and keeps the seam symmetric.

### Methods

| Name | Signature | Purpose |
|------|-----------|---------|
| `equipCosmetic` | `(kind: 'classSkin' \| 'mechChroma', ref: number \| string) => EquipResult` | Equip a skin or chroma the player owns (e.g. skin index 0..3 per class, or mech chroma id). Server validates ownership against `armoryUnlocks`; offline sim validates locally. |
| `unequipCosmetic` | `(kind: 'classSkin' \| 'mechChroma') => void` | Clear the equipped slot. |
| `refreshArmory` | `() => void` | Client request: "resend the armory delta". The server treats this as a no-op message-wise (snaps are already periodic); it exists so the UI can nudge after a quest completion. |
| `setArmorySeason` | `(seasonId: string) => void` | Server-only (called from `server/`, not the client IWorld facade). Toggles the active season at the realm level. |
| `previewCosmetic` | `(kind, ref) => void` | Client-only paint hook: tells the char_window 3D turntable to load the candidate; never mutates `armoryLoadout`. The seat for the existing `char_window` preview already lives in HUD-land; the painter passes the ref through. |

Two of those five are online-only frames (`setArmorySeason` is server
truth; `previewCosmetic` is a client UI hook). That is the same asymmetry
the existing `IWorldCosmetics` already has (e.g. `claimEventSkin` is a
command on both sides, `changeSkin` is a command on both). The facade
keeps the same shape across both worlds — the offline `Sim` is just
always-on and the server-authoritative paths run validation server-side.

### Result shapes

```ts
// Discriminated result for equip paths so the UI can render a reason
// without re-deriving it from sim state.
export type EquipResult =
  | { ok: true; loadout: ArmoryLoadout }
  | { ok: false; reason: 'not-unlocked' | 'invalid-ref' | 'wrong-class' };
```

The render-side then maps `reason` to a `t()` key in the catalog
(`armory.fail.notUnlocked` etc.). No string literals in sim.

## Persistent state: where it lives

Two write-classes, both already in the save path:

1. **Account-scoped unlocks** (e.g. "completed Season 1 quest line so I
   own the Verdant Helm chroma").

   Lives on `AccountCosmetics` (`src/world_api/cosmetics.ts`). Existing
   shape:

   ```ts
   interface AccountCosmetics {
     completedQuestIds: string[];
     mechChromaIds: string[];
   }
   ```

   Add a single field, **scoped to the season catalog so we don't pollute
   the legacy field**:

   ```ts
   interface AccountCosmetics {
     completedQuestIds: string[];
     mechChromaIds: string[];
     armoryUnlocks: ArmoryUnlockId[]; // stable cosmetic ids the account owns
   }
   ```

   `ArmoryUnlockId` is `string` (the cosmetic id from the catalog).
   Account-scoped because a quest completing on any character unlocks
   the cosmetic for that account, matching `mechChromaIds` semantics.

2. **Per-character equipped loadout** (e.g. "this paladin is wearing
   skin 2 and the amber_crimson mech").

   Lives on the character save as a new field on the existing
   `meta`-style save blob. The Online save shape is the existing one in
   `src/sim/sim.ts`'s `serializeCharacter` path (~line 1950). Offline
   `Sim` already serializes `accountCosmetics`; the same path adds the
   equipped loadout.

   No new server commands: the existing `changeSkin` / `unequipMechChroma`
   paths stay. The Armory calls them through the proper `IWorld` methods
   on `equipCosmetic` / `unequipCosmetic` (these routes wrap the existing
   server commands). That keeps the wire surface unchanged and adds zero
   new server endpoints.

The save back-compat story: `armoryUnlocks?` and `armoryLoadout?` are
optional on the save blob, default to empty / class-default on load,
matching how `deedLog?` / `deedsDone?` were added in PHAA-744.
Pre-725 saves load cleanly.

## The season concept (minimal)

`ArmorySeason` is an immutable record on the realm:

```ts
export interface ArmorySeason {
  /** Stable id; "s1" for Season 1. Future seasons get a new id, not a v2 of this. */
  id: string;
  /** Human label key leaf, e.g. "season1" -> i18n `armory.season.season1`. */
  labelKey: string;
  /** Server-side unix ms when the season began on this realm. */
  startedAt: number;
  /** Catalog revision number; bumped when content is added. */
  catalogVersion: number;
}
```

Default (no season set) is `null`. The Armory panel renders an empty
state when `armorySeason` is null. The v3 plan defers season turnover;
the gating is purely additive — "Season 1 grants X, Y, Z when quest A
completes" — no expiry means no wipe, no time pressure.

The catalog (`armoryCatalog`) is a flat static table in
`src/sim/content/skins.ts` (same family as `MECH_CHROMAS`,
`EVENT_SKIN_TIERS`, `SKIN_COUNTS`):

```ts
export interface ArmoryCatalogEntry {
  id: string;                              // stable, unique across the catalog
  kind: 'classSkin' | 'mechChroma';
  /** For classSkin: per-class skin index. For mechChroma: the chroma id. */
  ref: number | string;
  /** Optional human-friendly group ("Season 1 / Verdant Set"). */
  groupKey?: string;
  /** Required quest id to unlock (optional; cosmetic is free if absent). */
  requiresQuestId?: string;
  /** Season id this entry belongs to (e.g. "s1"). */
  seasonId: string;
}
```

`SEASON_1_ARMORY` is the first batch (initial scope: ~6 class skins
across the 9 classes and the 15 mech chromas, all gated by the existing
`completedQuestIds[]` field or free where already earned). The catalog is
host-agnostic, lives in `sim/content/`, and is exposed via the
`IWorld.armoryCatalog` read so `render/` and `ui/` never import
`sim/content/`.

## Wiring `completedQuestIds[]` to unlocks

`accountCosmetics.completedQuestIds[]` is currently write-only. The
server (`server/`) is the only writer today (quest turn-in path). The
read happens in one place: the new `armoryUnlocks` computation runs at
load (offline) and at every reception of a `cosmetics` delta (online).

The unlock resolver is a pure function in `src/sim/content/skins.ts`:

```ts
export function resolveArmoryUnlocks(
  completedQuestIds: readonly string[],
  catalog: readonly ArmoryCatalogEntry[],
): Set<string> {
  const owned = new Set<string>();
  const done = new Set(completedQuestIds);
  for (const entry of catalog) {
    if (!entry.requiresQuestId) {
      owned.add(entry.id);
    } else if (done.has(entry.requiresQuestId)) {
      owned.add(entry.id);
    }
  }
  return owned;
}
```

Direct unit test: `tests/sim.test.ts`-style (Vitest, simulator style),
host-agnostic, no DOM. Asserts a few catalog entries (free, gated,
multi-gate) resolve correctly.

The mismatch between the existing `IWorldCosmetics.changeSkin` (which
takes a class skin index) and `equipCosmetic` (which takes a
catalog-aware ref) is intentional: `changeSkin` is the in-game changer
(legacy, used by the skin-event overlay), `equipCosmetic` is the
Armory's authoritative path. They both write the same underlying
`meta.equipment` slot through the same `changeSkin` server command
(equipped skin index is per-character, persistent on the save); the
Armory just gates the choice on the catalog.

## HUD panel: pure-core + thin consumer

New module: `src/ui/armory_view.ts` (pure, Node-testable, no DOM).
Builds an `ArmoryView` from `IWorld` data: `{ tiles: ArmoryTile[],
filterState, equippedSet }`. Each `ArmoryTile` carries the renderer's
inputs (id, label key, locked, equipped, unmetRequirements[], previewRef)
and is rendered with `esc()` and `t()` at the boundary.

Thin consumer: `src/ui/armory_window.ts` (DOM painter, same family as
`char_window.ts` / `housing_window.ts`). Paints the window root, wires
the open/close, the equip callbacks, the filter chips, the locked-state
tooltips, and the preview-on-hover hook into the existing char_window
turntable. No business state here.

`Hud` keeps the open/close dispatcher (`openArmoryWindow` /
`closeArmoryWindow`) and a private ctor holding the painter. Following
the `charWindow` pattern exactly.

Keybind: `A` opens the Armory (single-key, primary slot). Mobile: a
button in the existing character-sheet menu (the slide-out), not a new
chrome tray. Tracking which mobile entry-point to use is a one-line
follow-up; the panel itself is keyboard/touch agnostic.

Tokens: the panel uses the existing chrome tokens
(`--color-window-bg`, `--color-window-border`, `--color-quality-*`).
Nothing raw.

i18n: every label is a `t()` key in `src/ui/i18n.catalog/hud.ts` (or
`hollow.ts` if the branch is project-specific). The new leaves are
`armory.title`, `armory.season.<seasonId>`, `armory.tile.locked`,
`armory.tile.equipped`, `armory.fail.notUnlocked`, `armory.fail.wrongClass`,
`armory.unmet.<...>` (per-mismatch reason). The PR-tier gate English-only
exception (M16) applies: a wordy new string gets the five non-Latin
fills in the same change.

## Gate deltas in the implementation commit

| Gate | Change |
|------|--------|
| `tests/world_api_parity.test.ts` (W0c) | Bump pinned count 188 -> 199; add `FACET_ARMORY` with the 11 member names; add the 11 new entries to `IWORLD_MEMBERS` (4 data + 7 method shapes); re-assert the sorted-name snapshot. |
| `tests/snapshots.test.ts` (W0a) | Add `armory` to `ALL_DELTA_KEYS` (43 -> 44); add `armory: 'armorySnapshot'` (or fan-out: `armorySeason`, `armoryUnlocks`, `armoryLoadout`) to `TERSE_TO_IWORLD`; add a non-default snapshot round-trip test. The terse key contract is the wire protocol. |
| `tests/command_schema.test.ts` (W0b) | Add `equipCosmetic` / `unequipCosmetic` / `refreshArmory` to the client send-set; add `setArmorySeason` to the DISPATCH_ONLY side (server push). |
| `tests/architecture.test.ts` | New modules under `src/sim/` (e.g. `src/sim/cosmetics/armory.ts`) must satisfy purity (no DOM/Three/render/ui imports). |
| `tests/parity/` | If a new sim-side module draws `rng` (e.g. season-roll), the parity draw-order digest must NOT shift. The Season 1 mechanic in this ticket is **non-rng** (derived from completed quests), so the digest stays green without regeneration. |
| `tests/hud.test.ts` / `tests/i18n_completeness.test.ts` | Wordy new keys get M16 fills. |
| `tests/localization_fixes.test.ts` | If any sim-side emit material is added (likely none — the Armory is read-only), the matcher rule in `src/ui/sim_i18n.ts` updates in the same change. |

The pre-commit `npm run ci:changed` and the pre-push `npm run pr_gate_local`
must be green for the implementation commits. The branch is `feature/phaa-725-armory-season1`.

## Reviewer path

The ticket notes "recommend an architecture-reviewer pass on the
IWorld extension before implementation given the new persistent-state
facet." The architecture-reviewer (`/.claude/agents/architecture-reviewer.md`)
is scoped to `src/sim/` and is a diff-reviewer. The review pass fires
against the implementation PR, not this design doc. The PR is the
right artifact for the reviewer to read because the gates are runnable.

Until the PR exists, the questions the reviewer (and Marlowe) should
flag-block on are:

1. Is the 11-member facet count right, or is anyone overloaded?
2. Is the `armoryLoadout` per-character vs `armoryUnlocks`
   account-scoped split the right boundary?
3. Should `equipCosmetic` be a method at all, or just a wrapped
   `changeSkin` + `unequipMechChroma`? (Tradeoff: a single method
   gives the UI one error path; the two-method wrap keeps the wire
   surface unchanged.)
4. Does the catalog want a `seasonId` field on every entry, or a
   top-level `seasonId -> ids[]` map? (Field-on-entry is friendlier
   to a future "list all cosmetics for season X" query.)
5. Is the v0 `s1` season identifier spelled at the right layer
   (catalog data, not the realm config)?

A "proceed" or "revise" call on those five lets the implementation
commit land in one or two clean follow-ups.

## Plan, if approved

1. Implementation PR (single branch, ~6 commits):
   - sim content: `feat(content): Season 1 armory catalog + unlock resolver`
   - world_api: `feat(world_api): IWorldArmory facet (Season 1)`
   - sim: `feat(sim): armory system module (SimContext seam + loadout persist)`
   - net: `feat(net): ClientWorld armory mirror (snapshot + commands)`
   - ui: `feat(ui): armory view + window module (pure-core + thin consumer)`
   - tests: `test(sim): armory resolver + loadout round-trip`
   - gates: `chore(gates): W0a/W0b/W0c re-pin for armory facet`
   - l10n: `feat(i18n): armory catalog keys (en)`
2. Local `scripts/pr_gate_local.sh` green.
3. PR opened, architecture-reviewer dispatched, Marlowe / board review.
4. After merge: a follow-up PHAA ticket scaffolds any
   season-expiry / Claudium-decoupling work that this ticket explicitly
   defers.

## Non-goals, reaffirmed

- No new 3D assets. The 3D preview path is the existing
  per-character turntable, reused.
- No new collectible types, no new currency, no new quest types.
- No Claudium store, no paid cosmetics, no token economy.
- No season expiry / time-limited unlocks. The "season" is a label and
  a content grouping, not a clock.
- No mobile-specific redesign — the existing character-sheet menu entry
  is the mobile door.
