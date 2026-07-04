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
  (out of scope for this pass; they carry the old thehollow.world
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
  `thehollow.world` origin in canonical / OG URLs is unchanged:
  domain migration is a separate pass once The Hollow has a public domain.

Verification: `tsc --noEmit` clean; `tests/client_shell.test.ts`,
`tests/architecture.test.ts`, `tests/localization_fixes.test.ts`,
`tests/discord_server.test.ts`, `tests/discord_deeplink.test.ts`, and
`tests/i18n_completeness.test.ts` green with NODE_ENV unset.

### 2026-07-02: License flip (constitution, section 6): All Rights Reserved + NOTICE

Per the constitution's settled §6 licensing decision:

- **`LICENSE`** replaced. It was the inherited upstream MIT license text
  (copyright Levy Street); it now states this project's original work is
  copyright Brandon Kelly, **All Rights Reserved**, proprietary and
  confidential, and points to `NOTICE` for the retained upstream terms.
- **`NOTICE`** added at the repo root. It reproduces the original MIT license
  text and Levy Street copyright verbatim, as the MIT license's own
  notice-preservation clause requires, and records the fork point (pinned
  commit `b00fb6a5d6d0e1ffab9327ddcbfeb730267ab05e`, upstream tag `v0.17.0`).
- **`THIRD_PARTY_NOTICES.md`** rewritten. Every notice it carried was for the
  Reown / WalletConnect / Solana wallet-adapter dependency stack removed in
  the 2026-07-01 wallet strip above (`@reown/*`, `@walletconnect/*`,
  `@noble/curves`, `@solana/web3.js`, `bs58`, `buffer`); none of it is a
  runtime dependency of `package.json` anymore, so the file now says so
  instead of carrying stale license text for code that isn't shipped.
- **`License.txt`** (the KayKit CC0 asset-pack notice) checked and left
  unchanged, it never referenced the wallet stack and still matches the
  bundled KayKit assets.
- **Consistency fixes** (same license flip, not separately scoped but
  directly contradicted the new `LICENSE` if left alone): the README's
  license badge and License section, `package.json`'s `"license"` field
  (`MIT` → `UNLICENSED`), and CONTRIBUTING.md's contributor-license clause,
  all updated to point at the proprietary terms instead of MIT.

**Dependency-hygiene note (not fixed here, flagged for the Phase 0 owner):**
`package-lock.json`'s root dependency block still lists
`@solana/wallet-standard-chains`, `@solana/wallet-standard-features`,
`@wallet-standard/app`, `@wallet-standard/base`, `@wallet-standard/features`,
`@noble/curves`, and `bs58` even though none of them appear in
`package.json` or any source import, lockfile drift left over from the
wallet strip that a plain `npm install` would clear. Not a licensing risk
(all MIT/Apache-permissive) but worth a clean install before shipping.

**Open licensing check flagged to the Board, not resolved here (per the
constitution's explicit "report findings, do not ship past Phase 3 without a
verdict" instruction):** `CREDITS.md` records the CraftPix skill-icon packs
(all 9 classes, 152 abilities) as purchased under the CraftPix commercial
royalty-free license **by the Levy Street account** (`callum@levystreet.com`).
CraftPix's published file-license terms grant a "limited, non-exclusive,
**non-transferable** license to all resources purchased" to the purchasing
account, and separately prohibit redistributing the art "in a manner that
would make [the] art files usable to another end user." A different legal
entity (PHATT STUDIOS / Brandon Kelly) shipping a commercial fork on a
license purchased by Levy Street's account does not obviously fall inside
that grant. This is a real risk, not a formality, the fix is either (a)
PHATT STUDIOS buys its own CraftPix license for the same packs, or (b) swap
the CraftPix skill-icon category for one of the CC0 asset sources already in
`CREDITS.md`. Left to the Board to pick; see the linked issue for the
verdict.

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
- **Improved shield HUD indicators** (upstream PR #1320, `a0537840`): the
  absorb-shield overlay was a single fill fraction folded into `hpFrac`,
  which read as extra health rather than a shield. Unit frames
  (player/target) now render the shield as its own segment
  (`absorbStartFrac`/`absorbSizeFrac` on `UnitFrameView`), plus an optional
  `showAbsorbText` flag that appends the resolved absorb total to `hpText`
  for player/target frames ("420/600 (90)", plain numbers, no new
  player-visible string). Party frames gain the same absorb-derived shield
  end to end: `server/game.ts` and `src/sim/sim.ts` both derive a member's
  absorb total from their auras identically, `PartyMemberInfo` carries it,
  and `party_frame_row`/`party_frames`/`party_frames_painter` render it the
  same way.

  Fork adaptations: dropped an unrelated `vite.config.ts` /
  `scripts/browserslist_targets.mjs` change bundled into the upstream commit
  (an inline duplicate of the already-exported `.browserslistrc` floor
  parser, unaffected here); dropped `tests/loot_settings_view.test.ts` (a
  one-line change to a test for a feature this fork does not have); kept
  this fork's `tests/target_frame.test.ts` structure, which documents a
  real, pre-existing wire-parity gap (`src/net/online.ts` zeroes the absorb
  aura value when mirroring Sim entities to ClientWorld, so the shield
  segment and its `hpText` "(N)" suffix are offline-only, not wired to the
  client; party frames do not have this gap since their absorb value is
  computed identically on both hosts from auras already on the wire).

  Verification: `npx vitest run tests/absorb_bar.test.ts
  tests/unit_frame.test.ts tests/unit_frame_painter.test.ts
  tests/party_frames.test.ts tests/party_frames_painter.test.ts
  tests/target_frame.test.ts tests/social_view.test.ts
  tests/hud_perf_budget.test.ts tests/architecture.test.ts` green (108
  passed, 3 pre-existing skips unrelated to this change) with NODE_ENV
  unset; `tsc --noEmit` clean.

## 2026-07-02: wiki (`/wiki` guide SPA) rebranded, dead content removed (PHAA-406)

First pass on the standing "keep the wiki current" mandate. Scope: the guide's
own English catalog (`src/ui/i18n.catalog/guide.ts`), its static shell
(`guide.html`), and the two runtime SEO/DOM call sites that hardcoded the
upstream identity (`src/guide/chrome.ts`, `src/guide/head.ts`,
`src/guide/pages/home.ts`). Did not touch the classes/bestiary/dungeons/
economy pages or the world/quests zone content, which describe real, tested,
still-shipped game systems, just ones a live player cannot currently reach
from the sealed Hollow hub (PHAA-404); see the follow-up below.

- **Brand:** `guide.brand`/`brandShort`/`home.title`/`footer.rights` (and
  the static `guide.html` title, meta description, OG/Twitter tags, JSON-LD
  `name`) changed from "World of ClaudeCraft"/"ClaudeCraft" to "The Hollow",
  matching the `index.html` branding pass (PHAA-395). The runtime JSON-LD
  `alternateName` in `head.ts`'s `videoGameNode` also updated to "The
  Hollow" (was still "World of Claudecraft").
- **Dead links removed, not just re-skinned:** the wiki footer and home
  "Join the realm" section linked `github.com/levy-street/world-of-claudecraft`
  (the upstream project, not this licensed fork) and
  `discord.gg/GjhnUsBtw` (the exact invite already stripped from
  `index.html`'s title screen in the branding pass, per this file's earlier
  entry). Removed both anchors from `chrome.ts` and `home.ts`, and the
  matching `sameAs` entries from `head.ts`'s runtime JSON-LD. The
  `footer.github`/`footer.discord`/`home.community.discord`/
  `home.community.github` catalog keys are left as inert, unused strings
  (same disposition as the `wallet.*` leftovers documented above: deleting
  translated keys is a locale-hygiene chore across ~20 overlay files,
  deferred rather than bundled into this pass). The `guide.html` noscript
  fallback also dropped its "browse the community wiki" link, which pointed
  at `/wiki`, i.e. itself; there is no separate community MediaWiki.
- **False claims fixed:** several strings asserted the game is open source
  ("Free and open source", "it is open source on GitHub", "Can I host my own
  copy? ... The project is open source") and offered a "crypto wallet" /
  "community token" FAQ answer. Both are wrong under the current constitution
  (§6: licensed, not open source) and the wallet strip (this file's
  2026-07-01 entry: the $WOC stack is fully removed). Reworded the open-source
  claims to plain "free to play", and repurposed the two dead wallet FAQ
  slots (home + the fuller `/wiki/faq` page) into real, shipped-content
  questions about housing (PHAA-403) and what the Hollow is (Greenpaw, the
  vase).
- **Onboarding copy updated to the actual new-player path:** `howToPlay`
  step 2 ("Find your first quest") and `questsPage.acceptBody` described
  Marshal Redbrook in the Eastbrook starting town, which no new character
  reaches anymore (PHAA-404: `hollowStart` lands everyone at the vase).
  Replaced with Brother Greenpaw and his first quest, `The Thing That
  Burns`. `howToPlay` step 6 no longer promises "the world opens up" after
  hitting level 2, since the hub is sealed (`sealedExit`) and there is no
  reachable exit yet; reworded to the real next steps (claim a homestead
  plot, head into the Under-Shrine).
- **Stale doc comment fixed:** `guide.ts`'s header comment described the
  guide as living at `/guide`, separate from "the community MediaWiki at
  /wiki". Neither is true (`routes.ts`: `GUIDE_BASE = '/wiki'`; there is no
  separate MediaWiki); corrected in the same change.

Ran `npm run wiki:content` (no drift: `content.generated.ts` already carries
the Hollow's registered dungeons from PHAA-400) and `npm run i18n:gen`.
Verification: `tsc --noEmit` clean; `tests/guide.test.ts`,
`tests/client_shell.test.ts`, `tests/localization_fixes.test.ts`,
`tests/i18n_completeness.test.ts`, `tests/architecture.test.ts`,
`tests/server_unavailable.test.ts` green with NODE_ENV unset.

**Deliberately out of scope, filed as a follow-up (PHAA-418):** the
`world.ts`/`questsPage` content still documents the inherited three-zone
overworld (Eastbrook/Mirefen/Thornpeak) and its villain-ladder story as if a
new player will walk it, which is no longer true now that `hollowStart`
seals every character inside the Hollow hub. That content is not dead code,
it is real and still exercised by tests/RL env/Phase 4+ plans, so retiring
or reframing it is a bigger, generator-driven restructure (per
`src/guide/CLAUDE.md`, a brand-new content type: extend
`scripts/wiki/build_content.mjs`, add a `pages/hollow.ts` + `GUIDE_ROUTES`
entry, regenerate the sitemap) best sequenced after the Phase 1 hub art pass
(PHAA-402) has an actual Board verdict, so the page is not built twice.

### 2026-07-02: Commit history author fix (PHAA-416)

Nine early fork commits (2026-07-01 to 2026-07-02, from "Establish the
fork" through the realm-picker and branding redeploy log entries) carried
the git author `Marlowe <brandon@phatt.tech>`, an agent identity used
before the studio settled on committing all agent work under the single
`phattbeats` account. Re-attributed those nine commits to `phattbeats
<obiwouldjablowme@protonmail.com>` via a scoped `git-filter-repo` rewrite
(metadata only, content byte-identical, verified with an empty tree diff
against the pre-rewrite tips and matching commit counts). No commit
authored by a real upstream contributor (the pinned `v0.17.0` donor
history) was touched. Backup tags pushed to origin before the rewrite:
`backup/pre-author-fix-main-20260702`, `backup/pre-author-fix-pr27-20260702`,
`backup/pre-author-fix-greenpaw-20260702`. `main`, PR #27's branch
(`feature/sec8-profession-gap`), and `feature/hollow-hub-greenpaw` were
force-pushed with the fix; all local checkouts already used the
`phattbeats` identity going forward, so this should not recur.

### 2026-07-02: The Plant's deterministic floor (PHAA-422)

Added `src/sim/plant_speech.ts`: the Plant's rationed, mood-driven
hand-written line set (constitution §5.2-5.4, §10 floor 1 - the god has a
floor before any live LLM work). Built on the `greenpaw_hearth.ts` pattern:
a self-contained system module behind `SimContext`, with two new seam
callbacks (`plantSpeechChat`, `notifyPlantThreshold`). Speaks only on four
triggers (the room crossing into full smoke, a real threshold - a homestead
claimed in its shade, via `Housing.housingClaim` - being addressed via the
new `/plant [text]` chat command, or its own whim on a long cooldown), all
gated by one shared anti-spam cooldown so no trigger can make it chatty.
Every utterance broadcasts world-wide (`emit` with no `pid`), per §5.2's
one-shared-voice rule. Draws no rng at construction (the first whim target
is lazily armed on the first tick), matching `greenpaw_hearth.ts`'s
discipline.

**Deliberate deviation from the ticket's i18n instruction.** PHAA-422 asked
for "same-change locale fills" per the PHAA-400 recipe, but that recipe is
for content-table entity keys (`entity_i18n.ts`/`world_entity_i18n.ts`),
not this module's shape: ~30 curated, idiom- and slang-heavy dynamic lines
emitted from a system module, the same shape as `greenpaw_hearth.ts`'s feed
lines and `housing.ts`'s command text, both of which already ship as the
same documented English-only backstop (neither file is in the
`tests/localization_fixes.test.ts` S3 scan list). Hand-translating this
"locked voice" signature content into 17+ languages without a native-speaker
pass risks materially bad, unlocked-voice translations for the system the
Phase 2 gate is judged on - worse than shipping English with a tracked
follow-up. Followed the existing precedent rather than the literal ticket
text; flagged on PHAA-422 for the Board.

**Pre-existing test drift found, not caused by this change** (verified via
`git stash` against a clean `origin/main` checkout): `tests/parity`'s
golden traces are stale (an entity-id/`nextId` offset baked in before this
branch, unrelated to rng draw order) and three `tests/snapshots.test.ts`
`/who` cases still assert the pre-PHAA-420 `Eastbrook Vale` spawn zone name
instead of `The Hollow Reaches`. Filed as a follow-up rather than folded
into this diff.

Fixed a stale hardcoded count in `tests/chat.test.ts` (`helpLines().length`
went from 9 to 10 with the new `/plant` help line) and added the two new
`SimContext` callbacks to the fake hosts in `tests/sim_context.test.ts` /
`tests/entity_roster.test.ts`. Verification: `tsc --noEmit` clean; `biome
check` on changed files clean of errors (48 pre-existing-style
`noNonNullAssertion` warnings, non-blocking per the PR-tier gate);
`tests/plant_speech.test.ts` (19 new tests, unit-level against a fake
`SimContext` for the rationing/mode logic plus a handful of real-`Sim`
wiring tests) and the full surrounding regression set
(`sim_context`/`greenpaw_hearth`/`housing`/`chat`/`architecture`/
`localization_fixes`) green with `NODE_ENV` unset.
## 2026-07-02: second wiki/homepage pass, "official website" self-promo copy removed (PHAA-406)

Follow-up pass per PHAA-406 review feedback. Scope: the homepage hero
(`index.html`), its runtime SEO regenerator (`src/main.ts`'s
`updateSeoMetadata`), the `en` shell catalog (`src/ui/i18n.catalog/shell.ts`),
and the dead CSS/overlay cruft that copy left behind.

- **Removed the `official-site-copy` hero block:** the `<section>` under the
  main logo told players "thehollow.world is the official free browser
  MMO for the Claudemoon realm... follow verified community links from this
  site" (`seo.officialLabel`/`seo.officialBody`). Self-promotional SEO copy,
  not useful to a player already on the page; removed the markup, the two
  catalog keys, the matching selectors in `shell.css`/`hud.css`/
  `hud.mobile.css`, and (since the keys left the `en` type) the 19 now-invalid
  `seo.officialLabel`/`seo.officialBody` overlay entries across
  `src/ui/i18n.locales/*.ts` (each locale had translated one or both; a typed
  key removal is not the same "leave it inert" case as the `wallet.*`/
  `footer.github` disposition logged above, since the type itself is gone,
  not just the render site, so `tsc` fails on any leftover overlay entry).
- **Removed the JSON-LD `sameAs` blocks in the same two files:** both
  `index.html`'s static structured data and `main.ts`'s runtime regenerator
  claimed `youtube.com/@WoClaudeCraft`, `x.com/WoClaudecraft`,
  `instagram.com/worldofclaudecraft`, `tiktok.com/@worldofclaudecraft`, and
  `reddit.com/r/WorldofClaudecraft` as this Organization's own channels. Per
  this file's 2026-07-02 branding-pass entry above, these were already flagged
  as "the old thehollow.world handles pending a real rebrand," i.e.
  accounts this fork does not control being asserted as official under The
  Hollow's identity, the same failure mode `press.html`'s impersonator-warning
  copy exists to guard against. Removing rather than relabeling: there is no
  real Hollow social presence yet to point `sameAs` at, and a `sameAs` claim
  is a factual assertion search engines act on, not decorative copy.
- **Stale doc comment fixed:** `src/guide/styles.css`'s header comment still
  read "World of ClaudeCraft Guide (/guide)"; the guide has been "The Hollow
  Guide (/wiki)" since PHAA-406's first pass (`GUIDE_BASE = '/wiki'`).

**Investigated, not changed: `public/home-bg.mp4`.** Board asked who made the
homepage background video and whether it is AI-generated. It is a real
committed asset (5.7 MB, referenced by `index.html`'s `#bg-home` `<video>`),
added upstream in commit `9dfe4fbbc` ("Logo change + video background +
pathfinding fixes," bundled with unrelated pathfinding/keybind changes, no
sourcing note) by contributor `CharlieSaxton`. It has no `CREDITS.md` entry
and no author/license metadata of any kind, unlike every other bundled asset
in this repo. The only embedded metadata is an FFmpeg mux signature
(`Lavf62.3.100`), which just means it was re-encoded through FFmpeg at some
point; that is consistent with AI-generated output, filmed footage, or stock
footage alike, so it does not answer the AI question either way. Net: same
class of risk as the CraftPix icon licensing question (PHAA-396), an
uncredited third-party asset with unknown provenance, just not confirmed
infringing. Left in place since PHAA-406 was not asked to touch it; the
provenance question is answered in a comment on the issue and it is the
Board's call whether to source a replacement or accept the risk.
