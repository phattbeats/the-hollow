# FORK-NOTES

The fork-discipline log mandated by the constitution (`docs/plan-the-hollow.md`, §6).
Every modification to this fork gets a dated entry below. Upstream is a
**one-time donor**: no tracking, no routine merges, ever. A specific upstream
fix may be cherry-picked by hand, with an entry here.

## Sync point

- **Upstream:** `levy-street/world-of-claudecraft`
- **Pinned commit:** `b00fb6a5d6d0e1ffab9327ddcbfeb730267ab05e` (upstream tag `v0.17.0`, 2,703 commits)
- **Local tag:** `upstream-sync-2026-06-30`
- **Inherited test suite verified green, unmodified** (2026-07-01): 569 test
  files, 5,997 tests passed, 0 real failures. Eight tests hit the 5-second
  default timeout on slow container hardware and all pass unmodified with
  `--testTimeout` raised; they are environment flakes, not failures.

## Staged content (applied at fork time, per the §6 mandate; not a gameplay modification)

- `src/sim/content/hollow.ts`: the Hollow zone module from the packet
  (Greenpaw, the first-run quests, the Under-Shrine skeleton). **Not yet
  registered** in `sim/data.ts`; registration is Phase 1 work.
- `docs/plan-the-hollow.md`: the constitution (v3.1), the game's governing document.
- `docs/sim/hollow-build-sim-v2.py`, `docs/sim/hollow-build-sim-v2-results.txt`:
  the section 8 build-depth simulation and its corrected first results.

## Modifications

### 2026-07-01: Wallet strip (constitution, section 6)

Removed the $WOC token / Reown / WalletConnect stack in full:

- **Server:** `server/wallet.ts`, `server/wallet_link.ts`, `server/woc_balance.ts`,
  plus their wiring in `server/main.ts`, `server/game.ts`, `server/db.ts`,
  `server/internal.ts`, `server/ratelimit.ts`, `server/discord.ts`, `server/discord_db.ts`.
- **Sim:** `src/sim/holder_tier.ts`, `src/sim/discord_tier.ts` (holdings- and
  boost-gated tier logic).
- **Client / UI:** `src/net/wallet.ts`, `src/ui/wallet_balance.ts`,
  `src/ui/holder_tier.ts`, `src/ui/discord_tier.ts`, plus references across the
  HUD, options, player card, bags window, account portal, settings, and the
  entry HTML.
- **Docs / assets:** the whitepaper PDF (and its landing-page footer link), the
  wallet PRDs (`docs/prd/woc/wallet-link.md`,
  `docs/prd/woc/holder-cosmetic-flair.md`), `scripts/wallet_e2e.mjs`, and the
  Reown / WalletConnect third-party licenses.
- **Landing page:** the $WOC contract-address block (`#token-ca` in
  `index.html`), its click-to-copy wiring in `src/main.ts`, and its CSS across
  `shell.css` / `hud.css` / `hud.mobile.css`.
- **Nameplates:** the holder-tier badge (painter, renderer DOM plumbing,
  `np-tier` CSS) and the dead `holderTier` / `holderBalance` entity fields,
  their wire mappings, and their parity-exclude entries.
- **Tests:** every wallet / holder-tier / discord-tier suite removed with its
  feature; surviving suites (security rate limits, settings, options, account
  portal, companion API gates, client shell, discord bot / server / widget)
  trimmed to the post-strip surface.

Keeps, per the mandate: the Discord bridge (`bot/`, `server/discord_oauth.ts`,
the relay, PFP / nickname / member-since / staff-role flair) stays; the old
`statusTier` / `dt` wire field now carries only a 0/1 linked flag. The bot no
longer requests the GUILD_MESSAGES intent (it existed for the removed points
ladder). Arena code stays dormant, its UI unbuilt, since it shares a file with
duels.

Known-inert leftovers (strings only, no live code path): the `wallet.*` i18n
catalog block and its locale overlays, and the admin `usage.metric.wallet*`
label keys. No `t('wallet...')` callers remain; deleting them is a
locale-hygiene chore across 20 overlay files, deferred out of the strip commit.

Verification: `tsc --noEmit` clean and the full Vitest suite green after the
strip (recorded in the commit for this entry). Note for future verifiers: run
the suite with NODE_ENV unset. This container exports NODE_ENV=production,
which makes Vitest report `import.meta.env.PROD = true` and flips the i18n
runtime into release semantics, failing five i18n / OG tests that are green
under a normal test environment.

## 2026-07-02: realm picker stat corrected to live online count (PR #9)

Upstream's landing-page realm picker shows lifetime accounts created labeled
just "Players" beneath the green Online dot, which reads as a live player
count (reported by the Board with 2 accounts and 0 players online). The
picker now binds to `players_online` from the same `/api/project-stats`
payload and uses the existing `stats.playersOnline` label. Files:
`index.html`, `play.html`, `src/main.ts` (`loadProjectStats`). Redeployed to
PHATT-RAID (image `eastbrook-game:phase0` rebuilt, container recreated with
`PUBLIC_ORIGIN=https://thehollow.phatt.vip`, previously theplant.phatt.vip).

### 2026-07-02: Branding pass, donate / upstream Discord and GitHub chrome stripped

- **Stripped upstream donate chrome:** removed the three donate anchors in
  `index.html` (community-link donate, header donate-cta, footer social-link
  donate), all pointing at `github.com/sponsors/levy-street`.
- **Stripped upstream Discord and GitHub community links:** removed the
  `discord.gg/GjhnUsBtw` and `github.com/levy-street/world-of-claudecraft`
  anchors from the title-screen community tray and the footer social row, and
  the matching `sameAs` entries from both JSON-LD blocks in `index.html` and
  the equivalent block `updateSeoMetadata` regenerates in `src/main.ts`. The
  YouTube, X, Instagram, TikTok, and Reddit `sameAs` entries are untouched
  (out of scope for this pass; they carry the old worldofclaudecraft.com
  handles pending a real rebrand of those accounts).
- **Discord in-game surfaces gated off, not deleted:** added
  `src/ui/discord_flags.ts` with a single `DISCORD_SURFACES_ENABLED = false`
  kill switch, ANDed into `main.ts`'s existing `DISCORD_BUILD_ENABLED` gate
  (which already fences the OAuth login button, the first-time login chooser,
  the link/unlink CTA banner, the in-game Discord panel and its U keybind,
  and the keep-account-before-unlink modal), plus an explicit early return in
  `Hud.updateTargetDiscordLine` (`src/ui/hud.ts`) so the target frame's
  `#tf-discord` line never renders a nickname or staff tag. The DOM containers
  (`#tf-discord`, `#discord-window`, `#discord-cta-banner`,
  `#discord-keep-modal`) stay in `index.html`, unmounted. The subsystem itself
  (`discord_widget.ts`, `discord_widget_view.ts`, `discord_status.ts`,
  `discord_deeplink.ts`, the server-side OAuth in `server/discord_oauth.ts`
  and the bot relay) is untouched and retained for a future PHATT Discord
  integration; flip `DISCORD_SURFACES_ENABLED` back to `true` when that lands.
- **Player-visible rename to The Hollow:** `index.html` title, meta
  description, OG / Twitter tags, `apple-mobile-web-app-title`, the hero
  `<h1>`, the main logo alt text, the JSON-LD `name` / `alternateName` fields
  (here and in `main.ts`), and `public/manifest.webmanifest` (`name`,
  `short_name`, `description`). English-only i18n catalog values in
  `src/ui/i18n.catalog/shell.ts` (the `en` block only; the legacy
  non-English blocks in that file are dead code the build does not read,
  left alone) and `src/ui/i18n.catalog/hud_chrome.ts`
  (`discord.panelTitle`), including `serverUnavailable.logoAlt`.
- **Intentionally left ClaudeCraft-branded strings**, out of the stated scope
  for this pass: `src/ui/i18n.catalog/index.ts` (`footer.copyright`,
  `nav.playAria`, `card.defaultRealm`, `card.shareText`,
  `card.nativeShareTitle`), `src/ui/i18n.catalog/game.ts` (`footer.*`,
  `nav.*`), and `src/ui/i18n.catalog/guide.ts` (`brand`, `brandShort`,
  `rights`, wiki prose). These are real player-visible ClaudeCraft strings
  the task did not name; flag for a follow-up branding pass.
- **Logo art landed (Brandon's pick on PHAA-395: weathered old-print wordmark,
  dark-portal mark):** the favicon set, `icon-192.png`, `icon-512.png`,
  `apple-touch-icon.png`, and `favicon.ico` are replaced in place with the
  portal mark; the title / loading / server-unavailable wordmark is the new
  `public/the-hollow-logo.png`; the OG / JSON-LD share image is
  `public/the-hollow-square.webp` (plus a PNG copy); the guide header uses
  `public/the-hollow-guide.webp`. References updated in `index.html`,
  `guide.html`, `src/main.ts`, `src/guide/head.ts`, `src/guide/chrome.ts`,
  `scripts/seo_audit.mjs`, and `tests/server_unavailable.test.ts`. The old
  `woc*` art files are kept on disk because `play.html` (the untouched
  upstream promo entry) still references them. Generator (SVG sources +
  render script) lives outside the repo in the studio workspace. The
  `worldofclaudecraft.com` origin in canonical / OG URLs is unchanged:
  domain migration is a separate pass once The Hollow has a public domain.

Verification: `tsc --noEmit` clean; `tests/client_shell.test.ts`,
`tests/architecture.test.ts`, `tests/localization_fixes.test.ts`,
`tests/discord_server.test.ts`, `tests/discord_deeplink.test.ts`, and
`tests/i18n_completeness.test.ts` green with NODE_ENV unset.

## 2026-07-02: branding deployed to PHATT-RAID (PHAA-397)

Rebuilt `eastbrook-game:phase0` from main at c7923808 (the branding merge) and
recreated the `eastbrook-game` container with the same config (network
phattvip, port 8787, media-cache bind, `PUBLIC_ORIGIN=https://thehollow.phatt.vip`,
restart unless-stopped). Verified live at thehollow.phatt.vip: title and OG
read "The Hollow: Classic-Style Web MMO", `/the-hollow-logo.png` wordmark
serves (200, 91 KB), `favicon.ico` matches the repo's portal-mark hash, zero
donate strings, no `discord.gg` invite links (the remaining Discord markup is
the retained OAuth login flow), no buildkit orphan containers left behind.

## 2026-07-02: the Hollow hub registered and the shrine gate opened (PHAA-400)

Registered `src/sim/content/hollow.ts` into the flat engine tables in
`src/sim/data.ts`, following the Drowned Temple merge exactly (Decision 19:
portal-instanced, nothing of the inherited storyline touched). The hub
(`the_hollow`, band 6) and the Under-Shrine (`under_shrine`, band 7) are
dungeon instances; the overworld shrine gate at `HOLLOW_HUB_DOOR_POS`
(-6, -22, south of the Eastbrook graveyard) is the portal in, and the hub's
cave mouth is an internal door into the Under-Shrine (the crypt-to-boss-arena
pattern). Opening bands 6 and 7 moved the arena east (ARENA_X 4200 to 5400)
and the delve band with it (DELVE_X_MIN 4800 to 6000), the same relocation
v0.10.0 performed when the arena landed.

One small engine extension: `DungeonDef.npcs` (instance-resident NPCs,
spawned on slot claim and freed with it, `dynamic` in the NPCS table so the
overworld loop skips them). Brother Greenpaw lives at the foot of the vase
inside the hub through it. `HOLLOW_PROPS` is deliberately NOT merged into the
overworld `PROPS` (its coordinates are hub-local); the Phase 1 dressing pass
renders it inside the instance.

Verification: `tests/hollow.test.ts` walks the acceptance end to end in-sim
(portal entry, Greenpaw at the vase, both first-run quests taken and
completed, the Under-Shrine spawn set, exits home); full `npm test` green
with NODE_ENV unset; wiki content regenerated by the pretest gate.

## 2026-07-02: inherited storyline neutralized, new characters land at the vase (PHAA-404)

The Hollow is now the game. Three `DungeonDef` fields (`sealedExit`,
`exitTo`, `homeRespawn`, types.ts) plus a `hollowStart` spawn policy on
`SimConfig`/`addPlayer` make the inherited base overworld unreachable while
leaving every line of its code intact and dormant:

- New characters land at the vase (`VASE_LANDING_POS`, a step south of it,
  hollow.ts): `addPlayer` under `hollowStart` enters a `the_hollow` instance
  and places anyone not already living in the hub band at the vase. Both real
  hosts set the flag (offline `src/main.ts`, server `server/game.ts` join);
  tests and the RL env keep the legacy base-world spawn so the dormant world
  stays testable. The server's `initialCharacterState` throwaway sim is left
  legacy on purpose: its serialized overworld pos is what routes a fresh
  character into the vase-landing branch on first join.
- The hub is sealed (`sealedExit`): no exit portal spawns inside it and
  `leaveDungeon` no-ops, so the shrine gate does not open from the inside.
- The Under-Shrine exits into the hub (`exitTo`): climbing out lands beside
  the cave mouth in the same party's hub instance, never Eastbrook.
- Death returns to the vase (`homeRespawn`, constitution section 7 "a
  teleport back to the vase, never items"): `releasePlayerSpirit` routes
  hub-family deaths back to the vase instead of a base-world graveyard.
- Rejoin normalization: a character saved inside the hub bands (or at the
  pre-fork arena/delve coordinates that now resolve to them) rejoins a live
  hub instance at the gate instead of being ejected to the overworld door.

`enterDungeon` grew a `quiet` option (suppresses enterText and the
party-size warning) for the internal hops above. Onboarding cold open
verified in-sim by `tests/hollow.test.ts`: create character, land at the
vase, Greenpaw's chain taken and completed there; sealed exit, cave exitTo,
death-to-vase, and pre-fork band rejoin all asserted.

Post-review hardening (same change, architecture-reviewer findings): the hub
is a SHARED instance (`sharedInstance`, one slot for the whole population,
claimed under a fixed `shared:the_hollow` key) so everyone meets at the same
vase and the 24-slot per-party pool can never exhaust under full-population
joins; and `enterDungeon` now returns a success boolean that the three
position-shifting callers (vase landing, exitTo, homeRespawn) check before
computing offsets, so a failed enter can never teleport a player off a stale
position into the dormant overworld. The Under-Shrine stays per-party.

## 2026-07-02: cherry-picked upstream QoL fixes (PHAA-408)

Four small, stable, non-draft upstream fixes hand-picked from
`levy-street/world-of-claudecraft`, each its own branch and PR through the
normal QA gate:

- **Windows path-separator fix in the architecture seam test** (upstream
  PR #1290, `18d08534`): `path.relative()` returns backslash-separated paths on
  Windows, but `SANCTIONED_VALUE_SIM_IMPORTS` in `tests/architecture.test.ts`
  is keyed with forward slashes, so the sanctioned `OVERHEAD_EMOTE_IDS` import
  never matched and the seam gate failed for every Windows contributor.
  Normalizes the relative path with `path.sep` before the lookup. No behavior
  change on POSIX. Clean cherry-pick, no fork drift.
- **Gamepad ignores input while the window is unfocused** (upstream PR #1318,
  `0310e5c3`): the browser only delivers keyboard and mouse input to a focused
  window, but kept reporting gamepad state to a visible, unfocused one.
  `GamepadManager.poll()` (`src/game/gamepad.ts`) now gates on
  `document.hasFocus()`, matching the existing keyboard/mouse focus rule:
  clears held stick movement, consumes the button state without dispatching
  (no stale edge fires on refocus), and skips camera, edge actions, and
  rumble while unfocused.

  `tests/gamepad.test.ts` did not exist in this fork (our v0.17.0 pin
  predates upstream's later APM-meter work, which added a test-only
  `onInputEdge` callback alongside `onAction`). Rather than pull that
  unrelated feature and its base test suite in with this fix, only the new
  window-focus coverage was ported, adapted to assert on the `onAction`
  callback our `GamepadCallbacks` actually has. `src/game/gamepad.ts` was
  also whole-file `biome check --write` formatted (pre-existing, unrelated
  statement-per-line violations the changed-file gate now surfaces); no
  functional lines besides the focus gate changed.
- **Show your own overhead nameplate** (upstream PR #1287, `213aea06`): adds a
  "Show My Nameplate" interface option (on by default, `showOwnNameplate` in
  `src/game/settings.ts`) that renders the local player's own overhead
  nameplate exactly as other players see it (name, level, guild, hp bar,
  linked-Discord PFP), instead of the classic suppressed self-view.
  `NameplatePainter` gates its per-field self-suppression on
  `suppressSelf = isSelf && !showOwnNameplate`; the pure `nameplate_view` core
  stops hiding the self plate and anchors it at the normal lift when the
  option is on.

  Fork adaptation: the upstream commit entangled this toggle with two
  features this fork does not have and dropped both from the cherry-pick:
  - The $WOC holder-tier badge (`e.holderTier`, `setNameplateTier`), stripped
    from this fork in the 2026-07-01 wallet strip (constitution section 6).
  - The developer badge / dev-tier name outline (`showDevBadges`,
    `e.devTier`, `devTierNameOutlineColor`), an upstream feature added after
    this fork's v0.17.0 pin that was never merged here.

  `suppressSelf` only gates the fields this fork's `nameplate_painter.ts`
  actually renders: name, hp, guild, the Discord role tint/tag, and the
  linked-Discord PFP indicator. "Show My Nameplate" is a new wordy English
  catalog value (`hudChrome.options.showOwnNameplate`), so its five
  non-Latin fills (zh_CN/zh_TW/ja_JP/ko_KR/ru_RU) landed in the same change
  per the M16 rule; resolved i18n bundles regenerated via `npm run i18n:gen`.

  Also surfaced, not fixed here (flagging per the docs-rot rule, a follow-up
  chore): `hudChrome.options.showWalletOnCharacterScreen` and
  `showWalletOnPlayerCard` are ANOTHER set of inert wallet leftovers (catalog
  + all locale overlays carry them, but no `options_view.ts` `boolToggle`
  call reads either key) that the 2026-07-01 wallet-strip entry above does
  not mention, distinct from the documented `wallet.*` catalog leftovers.
  Same locale-hygiene chore, wider surface than recorded.

  Verification: `npx vitest run tests/nameplate_view.test.ts
  tests/nameplate_projection.test.ts tests/options_view.test.ts
  tests/i18n_completeness.test.ts tests/architecture.test.ts
  tests/localization_fixes.test.ts tests/settings.test.ts` green (127
  passed, 3 pre-existing skips unrelated to this change) with NODE_ENV
  unset; `tsc --noEmit` clean.
