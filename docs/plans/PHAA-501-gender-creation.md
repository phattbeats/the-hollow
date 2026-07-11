# PHAA-501: Gender / sex field at character creation

> Plan target: ship the wire-format, persistence, and creation-flow plumbing
> for a `sex: 'm' | 'f'` field on the player, with the visual renderer
> resolving `player_<cls>_f` when present and falling back to the male model.
> The actual female GLBs themselves are owned by PHAA-539 (blocked on
> PHAA-537 / PHAA-538, neither of which Finch owns), so the manifest ships
> without `_f` VisualDefs and the fall-back path renders the male model
> until that PR lands. PR-scoped for PHAA-501 = plumbing, not assets.

## Goal
A character can be created as male or female. The choice persists, rides
the wire, and resolves through the visual manifest. Today every entity is
silently `sex: 'm'`. Tomorrow (PHAA-539), when `player_<cls>_f` entries
exist in `VISUALS`, female characters automatically render the female
model without further code changes.

## Architecture
- **One new typed field** `Sex = 'm' | 'f'` lives in `src/sim/types.ts`,
  added to `Entity` and to `PlayerMeta`. Both default to `'m'` so every
  pre-PHAA-501 save, NPC, mob, and blank entity keeps loading without a
  backfill pass.
- **One wire key** `'sx'` rides in `identityFields` (`server/game.ts`) and
  decodes to `e.sex` in `applyWire` (`src/net/online.ts`). Omitted when
  `'m'` to keep the wire lean (matches the `'mh'` / `'cat'` absent-means-default
  convention). Delta-guarded so a sex change bumps identity and re-fires.
- **One visual-key hook** in `visualKeyFor(e)` (`manifest.ts`): when the
  player is `'f'` and a `player_<cls>_f` VisualDef exists, return it.
  Otherwise fall back to `player_<cls>` (today's behaviour). This is the
  single point the future PHAA-539 `player_*_f` entries plug into.
- **One persisted field** `sex` on `CharacterState` (optional, defaults to
  `'m'` on load). Server `initialCharacterState` takes a `sex` arg;
  `serializeCharacter` writes it; `addPlayer` reads it back.
- **One REST + offline UI** adds a small `m / f` toggle to both
  `#charcreate-panel` (online) and `#offline-select`. Default `'m'`.
  Ships the value through `Api.createCharacter` (new optional `sex` arg),
  through the offline `startOffline`, and into the live
  `characterPreview` so the creation turntable shows the chosen sex the
  instant the variant GLBs exist.

## Files touched
- `src/sim/types.ts`              , add `Sex` type, add `sex: Sex` to `Entity`.
- `src/sim/sim.ts`                , add `sex: Sex` to `PlayerMeta`; persist
                                    `sex` in `serializeCharacter`; read it in
                                    `addPlayer` (back-compat default 'm');
                                    plumb `sex` through `addPlayer` opts.
- `src/sim/entity.ts`             , `baseEntity` / `blankEntity` set
                                    `sex: 'm'`.
- `src/net/online.ts`             , `Api.createCharacter` accepts optional
                                    `sex`; decode `w.sx` in `applyWire`;
                                    `blankEntity` sets `sex: 'm'`.
- `server/main.ts`                , accept `body.sex`, validate `m|f`,
                                    pass through `initialCharacterState`
                                    and `createCharacterCapped`.
- `server/db.ts`                  , `createCharacter` / `createCharacterCapped`
                                    signatures unchanged (state is the carrier).
- `server/game.ts`                , `identityFields` emits `sx` when
                                    `e.sex === 'f'`.
- `src/render/characters/manifest.ts` , `visualKeyFor` prefers
                                    `player_<cls>_f` for female players
                                    when the entry exists; otherwise
                                    `player_<cls>` (current behaviour).
- `src/render/characters/preview.ts` , add `setSex(sex)` that re-resolves
                                    the current visual key through
                                    `visualKeyFor`-style logic.
- `src/main.ts`                   , `selectedSex(...)` reads the new
                                    `.sex-toggle .sel` row; `startOffline`
                                    takes `sex`; `Api.createCharacter` is
                                    called with the chosen sex;
                                    `characterPreview.setSex` is called on
                                    toggle change to live-preview the
                                    variant (falls back to male model
                                    until PHAA-539 ships the GLBs).
- `play.html`                     , add a `sex-toggle` row to
                                    `#charcreate-panel` and
                                    `#offline-select`.
- `src/styles/shell.css`          , minimal styling for `.sex-toggle`
                                    consistent with `.skin-picker` chips.
- `src/ui/i18n.catalog/index.ts`  , add `auth.sex` /
                                    `auth.sexMale` / `auth.sexFemale`
                                    keys (English-only at the source;
                                    other locales regenerate via
                                    `npm run i18n:gen`).
- `tests/snapshots.test.ts`       , add `sx` to the expected identity
                                    field set so the snapshot lockstep
                                    pins the new terse key (only if it's
                                    not already covered; check first).
- `tests/gender_creation.test.ts` , new: round-trip `sex` through
                                    Sim, server wire encode/decode,
                                    visual-key resolution, CharacterState
                                    persist+load, and the
                                    createCharacterCapped SQL path
                                    (mocked).

## Sequence

### 1. Type + entity defaults
- `src/sim/types.ts`: add `export type Sex = 'm' | 'f'` (with the comment
  block from the in-flight diff), add `sex: Sex` to `Entity` after
  `skin`.
- `src/sim/entity.ts`: `baseEntity` returns `sex: 'm'`.
- `src/net/online.ts`: `blankEntity` returns `sex: 'm'`.

### 2. PlayerMeta + persistence
- `src/sim/sim.ts`:
  - Add `sex: Sex` to `PlayerMeta`.
  - `serializeCharacter` writes `sex: meta.sex` (so it lands in
    `CharacterState`).
  - `addPlayer` reads `opts?.state?.sex ?? 'm'` and assigns it to
    `meta.sex` and `e.sex` after the entity is built.

### 3. CharacterState typing
- `src/sim/sim.ts`: add `sex?: Sex` to `CharacterState` (optional so
  pre-PHAA-501 saves load cleanly, defaulting to `'m'` on read).

### 4. Wire encode (server)
- `server/game.ts` `identityFields`: after `if (e.skin) out.sk = e.skin;`
  add `if (e.sex === 'f') out.sx = 'f';` (omit when 'm' , default).

### 5. Wire decode (client)
- `src/net/online.ts` `applyWire`: after `e.skin = w.sk ?? 0;` add
  `e.sex = w.sx === 'f' ? 'f' : 'm';`.

### 6. Server create handler
- `server/main.ts`:
  - Validate `body.sex` against `['m', 'f']`; default `'m'`.
  - Extend `initialCharacterState(cls, name, skin, sex)` to call
    `sim.setPlayerSex(sim.playerId, sex)` after `setPlayerSkin`.
  - `createCharacterCapped(...)` call: pass `sex` through.
- `src/sim/sim.ts`: add `setPlayerSex(pid, sex)` analog to
  `setPlayerSkin` , sets `meta.sex` and `e.sex`, clamps to `'m'|'f'`.

### 7. Visual-key dispatch
- `src/render/characters/manifest.ts` `visualKeyFor`:
  ```ts
  if (e.kind === 'player') {
    if (e.skinCatalog === 'mech') return 'player_mech';
    const base = `player_${e.templateId}`;
    if (e.sex === 'f' && VISUALS[`${base}_f`]) return `${base}_f`;
    return VISUALS[base] ? base : 'player_warrior';
  }
  ```
  No new VISUALS entries are added here , the fall-back path keeps
  current behaviour until PHAA-539 lands the GLBs.

### 8. API surface
- `src/net/online.ts` `Api.createCharacter(name, cls, skin, sex)` ,
  `sex` defaults to `'m'` so every existing call site keeps working.
  POST body adds `sex` only when `'f'`.

### 9. UI: sex toggle on the creation screens
- `play.html`: inside `#charcreate-panel .char-create` and
  `#offline-select .char-create`, just below the class chip row, add:
  ```html
  <div class="sex-toggle" role="radiogroup" data-i18n-aria="auth.sex" aria-label="Sex">
    <button type="button" class="sex-opt sel" data-sex="m" role="radio"
            aria-checked="true" data-i18n="auth.sexMale">Male</button>
    <button type="button" class="sex-opt" data-sex="f" role="radio"
            aria-checked="false" data-i18n="auth.sexFemale">Female</button>
  </div>
  ```
- `src/main.ts`:
  - `selectedSex(rowSelector)` reads `.sex-opt.sel`'s `data-sex`.
  - On every `.sex-opt` click, toggle `.sel` + `aria-checked`, and call
    `characterPreview?.setSex(...)` so the live turntable flips
    immediately (today the model is identical , both render the male
    GLB , but the moment PHAA-539 adds `_f` VisualDefs, the toggle is
    wired).
  - `refreshOnlineSkins` / `refreshOfflineSkins` re-apply the current
    sex via `characterPreview.setSex(...)` so a class switch preserves
    the choice.
  - `startOffline(cls, name, skin, sex)` threads `sex` to the sim via
    the offline quick-start path (the offline `Sim` is built without
    a saved `state`, so we need to override `e.sex` /
    `meta.sex` post-creation , easiest: pass an `opts.sex` through to
    `addPlayer`).
- `src/ui/i18n.catalog/index.ts`: add
  `sex: 'Sex'`, `sexMale: 'Male'`, `sexFemale: 'Female'` under
  `auth`.
- `src/styles/shell.css`: minimal `.sex-toggle` row styling
  (segmented-control look matching the existing `.skin-picker` chips).

### 10. addPlayer opts
- `src/sim/sim.ts` `addPlayer` opts: accept `sex?: Sex`; assign to
  `meta.sex` and `e.sex` if set, otherwise `meta.sex`/`e.sex` keep the
  default `'m'` already on `baseEntity`.

### 11. Tests
- `tests/gender_creation.test.ts` (new): exercises
  - `serializeCharacter` round-trips `sex` through `CharacterState`.
  - `addPlayer` honours saved `sex: 'f'` and the new `opts.sex`.
  - `visualKeyFor` for a female player with no `_f` VisualDef returns
    the male key (back-compat).
  - Server `wireEntity` encodes `sx: 'f'` and omits it for `'m'`.
  - `Api.createCharacter` payload includes `sex: 'f'` only when chosen.
  - The `sim` arch-purity test (`architecture.test.ts`) still passes ,
    no new render/DOM imports cross into `src/sim/`.

### 12. i18n regen
- Run `npm run i18n:gen` so the resolved locale tables pick up the new
  English-only keys (other locales land as `pending`, which the PR
  tier allows).

## Out of scope (parked under PHAA-539)
- The actual `player_<cls>_f` VisualDefs and their GLB / texture assets.
- The Mixamo bone remap needed by Quaternius UBC (PHAA-538, Wren).
- Any `/change-sex` in-game command (the issue scope is creation only).

## Acceptance gate
- `npx tsc --noEmit` clean.
- `npx vitest run tests/gender_creation.test.ts tests/snapshots.test.ts
  tests/architecture.test.ts` green.
- `npm run biome -- --write` clean on changed files.
- A live character created through the online + offline flows has
  `sex: 'f'` stored in `characters.state` and renders as the male
  model today (fall-back path), switching to the female model the
  instant PHAA-539 lands a `player_<cls>_f` VisualDef.

## Risks + how they're handled
- **Old saves break on load** , mitigated by `sex?: Sex` (optional) and
  `e.sex = opts?.state?.sex ?? 'm'` defaults everywhere a `state` is
  read.
- **Wire snapshot test pins a fixed field set** , `sx` rides the
  identity record (first-sight + change), not a `maybe(...)` delta
  field, so it doesn't touch `ALL_DELTA_KEYS`. The terse→IWorld map
  doesn't list `sx` either (the IWorld-side name IS `sex`). Verify
  by running `tests/snapshots.test.ts` and adjusting the expected-set
  if the test pins identity keys explicitly.
- **A misclick creating a female that no model exists for** ,
  acceptable: the fall-back renders the male model. Net cost = visual
  silence today; tomorrow it Just Works.
- **Animation clip mismatch for the female rig** , out of scope; the
  asset PR (PHAA-539) carries clip maps per rig.